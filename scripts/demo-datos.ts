import type { Sql, TransactionSql } from 'postgres'
import { conectar } from './db-conexion.ts'
import { azar, entre, redondear } from './demo-azar.ts'
import { CANASTAS } from './demo-canastas.ts'
import { CLIENTES_DEMO, type ClienteDemo, PREFIJO_DEMO } from './demo-fuente.ts'

/**
 * Llena el CRM con datos de ejemplo coherentes con las reglas de negocio.
 *   pnpm db:demo            borra lo de ejemplo anterior y lo vuelve a crear
 *   pnpm db:demo --borrar   solo borra lo de ejemplo
 * Nunca toca filas fuera de PREFIJO_DEMO.
 */

const DIA = 24 * 60 * 60 * 1000
const QUITO = 5 * 60 * 60 * 1000 // UTC-5 fijo

/** Medianoche de hoy en Quito, expresada en UTC. */
function inicioDeHoy(ahora: Date): number {
  const local = ahora.getTime() - QUITO
  return local - (local % DIA) + QUITO
}

// Estado del pedido más reciente de cada cliente, en rotación, para que el tablero tenga de todo.
const ACTIVOS = [
  'nuevo',
  'en_proceso',
  'listo_para_entrega',
  'recolectado',
  'esperando_pago_para_recoleccion',
  'discrepancia_detectada',
  'nuevo',
  'en_proceso',
  'esperando_pago_para_entrega',
  'recolectado',
  'listo_para_entrega',
  'cancelado',
  'nuevo',
  'recoleccion_fallida',
  'en_proceso',
  'nuevo',
] as const
const CAMINO = ['nuevo', 'recolectado', 'en_proceso', 'listo_para_entrega', 'entregado']
const VERIFICADOS = new Set([
  'en_proceso',
  'esperando_pago_para_entrega',
  'listo_para_entrega',
  'entregado',
])

type Servicio = { id: string; nombre_item: string; metodo: string; precio_min: string }

export async function borrarDemo(sql: Sql): Promise<number> {
  const patron = `${PREFIJO_DEMO}%`
  await sql`delete from pedidos where cliente_id in (select id from clientes where telefono like ${patron})`
  await sql`delete from conversaciones where telefono like ${patron}`
  const borrados = await sql`delete from clientes where telefono like ${patron} returning id`
  return borrados.length
}

export async function crearDemo(sql: Sql, ahora = new Date()) {
  const servicios =
    (await sql`select id, nombre_item, metodo, precio_min from servicios where activo`) as unknown as Servicio[]
  const buscar = (nombre: string, metodo: string) => {
    const fila = servicios.find((s) => s.nombre_item === nombre && s.metodo === metodo)
    if (!fila) throw new Error(`El catálogo no tiene "${nombre}" (${metodo})`)
    return fila
  }
  const [operador] = await sql`select id from staff where rol = 'operador' limit 1`
  const hoy = inicioDeHoy(ahora)
  let rotacion = 0
  let franjaHoy = 0
  let totalPedidos = 0

  await sql.begin(async (tx) => {
    for (const [indice, demo] of CLIENTES_DEMO.entries()) {
      const telefono = `${PREFIJO_DEMO}${String(indice + 1).padStart(4, '0')}`
      const altaDias = demo.pedidos === 0 ? entre(0, 18) : entre(22, 29)
      const alta = new Date(
        Math.min(ahora.getTime(), hoy - altaDias * DIA + entre(8, 17) * 3600_000),
      )

      const [cliente] = await tx`
        insert into clientes ${tx({
          telefono,
          nombre_contacto: demo.contacto,
          nombre_negocio: demo.negocio,
          tipo_negocio: demo.tipo,
          canal_origen: demo.canal,
          modelo_facturacion: demo.consolidado ? 'consolidado_mensual' : 'por_pedido',
          aviso_privacidad_enviado_en: demo.canal === 'whatsapp_agente' ? alta : null,
          created_at: alta,
        })} returning id`
      if (!cliente) throw new Error(`No se pudo crear el cliente ${telefono}`)

      let ultimaActividad = alta
      for (let n = 0; n < demo.pedidos; n++) {
        const esUltimo = n === demo.pedidos - 1
        let estado: string = esUltimo
          ? (ACTIVOS[rotacion++ % ACTIVOS.length] ?? 'nuevo')
          : 'entregado'
        if (
          (demo.consolidado || demo.canal === 'presencial') &&
          estado.startsWith('esperando_pago')
        )
          estado = 'en_proceso'
        const diasAtras = esUltimo ? (estado === 'nuevo' ? 0 : entre(1, 4)) : entre(6, 20) - n
        const creado = new Date(
          Math.min(
            ahora.getTime() - 3600_000,
            hoy - Math.max(0, diasAtras) * DIA + entre(7, 11) * 3600_000,
          ),
        )
        ultimaActividad = creado
        await crearPedido(tx, {
          demo,
          clienteId: cliente.id,
          estado,
          creado,
          operadorId: operador?.id ?? null,
          hoy,
          franja: estado === 'nuevo' ? franjaHoy++ : 0,
          buscar,
        })
        totalPedidos++
      }

      if (demo.canal === 'whatsapp_agente') {
        await tx`
          insert into conversaciones ${tx({
            telefono,
            contexto: tx.json({
              nombre_whatsapp: demo.contacto,
              temperatura: demo.temperatura,
              necesidad: demo.necesidad,
              proxima_accion:
                demo.pedidos === 0 ? (demo.escalado ? 'escalado' : 'seguimiento') : 'pedido_creado',
              ultimo_mensaje_cliente: demo.ultimoMensaje,
              ultima_respuesta_agente: demo.escalado
                ? 'Le paso con una persona de nuestro equipo, en breve le escriben.'
                : 'Con gusto. Todo monto es un estimado pendiente de verificación en planta.',
              escalado: demo.escalado === true,
            }),
            ultima_interaccion: new Date(
              Math.max(ultimaActividad.getTime(), alta.getTime()) + 20 * 60_000,
            ),
            created_at: alta,
          })}`
      }
    }
  })

  return { clientes: CLIENTES_DEMO.length, pedidos: totalPedidos }
}

type EntradaPedido = {
  demo: ClienteDemo
  clienteId: string
  estado: string
  creado: Date
  operadorId: string | null
  hoy: number
  franja: number
  buscar: (nombre: string, metodo: string) => Servicio
}

async function crearPedido(tx: TransactionSql, e: EntradaPedido) {
  const { demo, estado, creado } = e
  const presencial = demo.canal === 'presencial'
  const canasta = CANASTAS[demo.tipo]
  const lineas = Array.from({ length: entre(1, Math.min(3, canasta.length)) }, (_, i) => {
    const elegido = canasta[(entre(0, canasta.length - 1) + i) % canasta.length]
    if (!elegido) throw new Error(`Canasta vacía para ${demo.tipo}`)
    const [nombre, metodo, min, max] = elegido
    const servicio = e.buscar(nombre, metodo)
    const cantidad = entre(min, max)
    const precio = Number(servicio.precio_min)
    return { servicio, cantidad, precio, subtotal: redondear(precio * cantidad) }
  }).filter((l, i, todas) => todas.findIndex((o) => o.servicio.id === l.servicio.id) === i)
  const primera = lineas[0]
  if (!primera) throw new Error('Un pedido de ejemplo quedó sin prendas')

  const estimado = redondear(lineas.reduce((suma, l) => suma + l.subtotal, 0))
  const verificado = VERIFICADOS.has(estado)
  // Uno de cada cinco conteos en planta sale distinto de lo declarado.
  const ajuste = verificado && azar() < 0.2 ? -primera.precio : 0
  const confirmado = verificado ? redondear(Math.max(0, estimado + ajuste)) : null
  const combo = !presencial && !estado.startsWith('esperando_pago') && azar() < 0.55
  const fundas = presencial ? null : entre(1, 4)

  const ventanaInicio = presencial
    ? null
    : estado === 'nuevo'
      ? new Date(e.hoy + (8 + (e.franja % 4)) * 3600_000)
      : new Date(creado.getTime() + DIA - (creado.getTime() % 3600_000))
  const pagoRecoleccion = estado === 'esperando_pago_para_recoleccion' ? 'pendiente' : 'n_a'
  const pagoEntrega = estado === 'esperando_pago_para_entrega' ? 'pendiente' : 'n_a'

  const [pedido] = await tx`
    insert into pedidos ${tx({
      cliente_id: e.clienteId,
      canal: demo.canal,
      estado,
      tipo_entrega: presencial ? null : combo ? 'combo' : 'a_la_carta',
      metodo_transporte_recoleccion:
        presencial || combo ? 'n_a' : pagoRecoleccion === 'pendiente' ? 'app' : 'propio_cliente',
      metodo_transporte_entrega:
        presencial || combo ? 'n_a' : pagoEntrega === 'pendiente' ? 'app' : 'propio_cliente',
      pago_recoleccion: pagoRecoleccion,
      pago_entrega: pagoEntrega,
      monto_recoleccion: pagoRecoleccion === 'pendiente' ? 3.5 : null,
      monto_entrega: pagoEntrega === 'pendiente' ? 3.25 : null,
      monto_combo: combo ? 5 : null,
      pago_lavado: demo.consolidado
        ? 'acumulado_mensual'
        : estado === 'entregado'
          ? 'pagado'
          : verificado
            ? 'confirmado'
            : 'estimado',
      monto_estimado_lavado: estimado,
      monto_confirmado_lavado: confirmado,
      numero_fundas: fundas,
      vehiculo_sugerido: fundas === null ? null : fundas === 1 ? 'moto' : 'auto',
      direccion_recoleccion: presencial ? null : demo.direccion,
      ventana_recoleccion_inicio: ventanaInicio,
      ventana_recoleccion_fin: ventanaInicio ? new Date(ventanaInicio.getTime() + 3600_000) : null,
      discrepancia_detectada: estado === 'discrepancia_detectada',
      discrepancia_motivo:
        estado === 'discrepancia_detectada'
          ? `Declararon ${primera.cantidad} y en planta se contaron ${primera.cantidad - 2}`
          : null,
      created_at: creado,
      updated_at: creado,
    })} returning id`
  if (!pedido) throw new Error('No se pudo crear el pedido de ejemplo')

  for (const l of lineas) {
    const [declarado] = await tx`
      insert into pedido_items ${tx({ pedido_id: pedido.id, origen: 'declarado', servicio_id: l.servicio.id, descripcion: l.servicio.nombre_item, cantidad: l.cantidad, metodo_elegido: l.servicio.metodo, precio_unitario: l.precio, subtotal: l.subtotal, created_at: creado })} returning id`
    if (!declarado) throw new Error('No se pudo crear la prenda de ejemplo')
    if (verificado) {
      const cantidad = ajuste !== 0 && l === primera ? Math.max(1, l.cantidad - 1) : l.cantidad
      await tx`insert into pedido_items ${tx({ pedido_id: pedido.id, origen: 'verificado', item_declarado_id: declarado.id, servicio_id: l.servicio.id, descripcion: l.servicio.nombre_item, cantidad, metodo_elegido: l.servicio.metodo, precio_unitario: l.precio, subtotal: redondear(l.precio * cantidad), created_at: creado })}`
    }
  }

  // Historial: del alta al estado actual, una hora por paso.
  const destino = CAMINO.indexOf(estado)
  const pasos = destino >= 0 ? CAMINO.slice(0, destino + 1) : ['nuevo', estado]
  let anterior: string | null = null
  for (const [i, paso] of pasos.entries()) {
    await tx`insert into pedido_eventos ${tx({
      pedido_id: pedido.id,
      estado_anterior: anterior,
      estado_nuevo: paso,
      actor: i === 0 ? (presencial ? 'operador' : 'agente') : 'operador',
      staff_id: i === 0 ? null : e.operadorId,
      motivo:
        i === 0
          ? 'Pedido creado'
          : paso === 'cancelado'
            ? 'El cliente canceló por WhatsApp'
            : paso === 'recoleccion_fallida'
              ? 'Nadie en la dirección a la hora acordada'
              : null,
      created_at: new Date(creado.getTime() + i * 3600_000),
    })}`
    anterior = paso
  }

  if (estado === 'discrepancia_detectada') {
    await tx`insert into correcciones_cotizacion ${tx({ pedido_id: pedido.id, monto_anterior: estimado, monto_corregido: redondear(estimado - 2 * primera.precio), motivo: 'Faltaban 2 prendas respecto de lo declarado', corregido_por_staff_id: e.operadorId, created_at: new Date(creado.getTime() + 2 * 3600_000) })}`
  }
}

async function principal() {
  const sql = conectar()
  try {
    const borrados = await borrarDemo(sql)
    console.log(`Borrados ${borrados} clientes de ejemplo anteriores.`)
    if (process.argv.includes('--borrar')) return
    const creado = await crearDemo(sql)
    console.log(`Creados ${creado.clientes} clientes y ${creado.pedidos} pedidos de ejemplo.`)
  } finally {
    await sql.end()
  }
}

if (import.meta.filename === process.argv[1]) {
  await principal()
}
