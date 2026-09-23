import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * La radiografía del negocio para la dueña: cómo va el mes contra el anterior,
 * qué prendas dejan la plata, cuántos de los que escriben terminan comprando y
 * quién vuelve. Es lectura pura y son las mismas cifras del CRM.
 *
 * Existe para que el agente pueda responder «¿cómo vamos?» con números y no
 * con una sensación.
 */

const ESTADOS_MUERTOS = ['cancelado', 'recoleccion_fallida']
const redondear = (n: number) => Math.round(n * 100) / 100

export type Periodo = { desde: Date; hasta: Date }

export type Movimiento = {
  desde: string
  facturado_usd: number
  pedidos: number
  ticket_promedio_usd: number | null
}

export type ComoVamos = {
  mes_en_curso: Movimiento
  mes_anterior: Movimiento
  variacion_facturado_pct: number | null
  prendas_top: { prenda: string; cantidad: number; facturado_usd: number }[]
  clientes: {
    nuevos_este_mes: number
    escribieron_sin_comprar: number
    conversion_pct: number | null
    recurrentes: number
  }
  nota: string
}

export type FilaPedido = {
  created_at: string
  estado: string
  monto_confirmado_lavado: number | null
  monto_estimado_lavado: number | null
  cliente_id: string
}

/** Un mes calendario de Quito, que es UTC-5 fijo. */
export function mesDe(ahora: Date, desplazamiento = 0): Periodo {
  const quito = new Date(ahora.getTime() - 5 * 60 * 60 * 1000)
  const desde = new Date(
    Date.UTC(quito.getUTCFullYear(), quito.getUTCMonth() + desplazamiento, 1, 5, 0, 0),
  )
  const hasta = new Date(
    Date.UTC(quito.getUTCFullYear(), quito.getUTCMonth() + desplazamiento + 1, 1, 5, 0, 0),
  )
  return { desde, hasta }
}

/** Lo que deja un periodo. Es aritmética pura: se prueba sin tocar la base. */
export function movimiento(todos: FilaPedido[], periodo: Periodo): Movimiento {
  // Un pedido cancelado o con recolección fallida no es una venta.
  const pedidos = todos.filter((p) => !ESTADOS_MUERTOS.includes(p.estado))
  const facturado = pedidos.reduce(
    (suma, p) => suma + Number(p.monto_confirmado_lavado ?? p.monto_estimado_lavado ?? 0),
    0,
  )
  return {
    desde: periodo.desde.toISOString().slice(0, 10),
    facturado_usd: redondear(facturado),
    pedidos: pedidos.length,
    // Sin pedidos no hay promedio: un 0 aquí se leería como «vendimos 0 por pedido».
    ticket_promedio_usd: pedidos.length > 0 ? redondear(facturado / pedidos.length) : null,
  }
}

async function pedidosEntre(periodo: Periodo): Promise<FilaPedido[]> {
  const { data, error } = await supabaseAdmin()
    .from('pedidos')
    .select('created_at, estado, monto_confirmado_lavado, monto_estimado_lavado, cliente_id')
    .gte('created_at', periodo.desde.toISOString())
    .lt('created_at', periodo.hasta.toISOString())

  if (error) throw new Error(`No se pudieron leer los pedidos: ${error.message}`)
  return (data ?? []) as FilaPedido[]
}

/** Qué prendas dejan la plata este mes, por ingreso y no solo por cantidad. */
async function prendasTop(periodo: Periodo) {
  const { data } = await supabaseAdmin()
    .from('pedido_items')
    .select('descripcion, cantidad, subtotal, pedido:pedidos!inner(created_at, estado)')
    .gte('pedido.created_at', periodo.desde.toISOString())
    .lt('pedido.created_at', periodo.hasta.toISOString())

  type Fila = { descripcion: string; cantidad: number; subtotal: number | null; pedido: unknown }
  const porPrenda = new Map<string, { cantidad: number; facturado: number }>()
  for (const fila of (data ?? []) as unknown as Fila[]) {
    const clave = fila.descripcion.trim().toLowerCase()
    const actual = porPrenda.get(clave) ?? { cantidad: 0, facturado: 0 }
    actual.cantidad += Number(fila.cantidad)
    actual.facturado += Number(fila.subtotal ?? 0)
    porPrenda.set(clave, actual)
  }

  return [...porPrenda.entries()]
    .sort((a, b) => b[1].facturado - a[1].facturado)
    .slice(0, 5)
    .map(([prenda, datos]) => ({
      prenda,
      cantidad: datos.cantidad,
      facturado_usd: redondear(datos.facturado),
    }))
}

async function clientesDelMes(periodo: Periodo, pedidosDelMes: FilaPedido[]) {
  const { data } = await supabaseAdmin()
    .from('clientes')
    .select('id')
    .gte('created_at', periodo.desde.toISOString())
    .lt('created_at', periodo.hasta.toISOString())

  const nuevos = (data ?? []) as { id: string }[]
  const compraron = new Set(pedidosDelMes.map((p) => p.cliente_id))
  const nuevosQueCompraron = nuevos.filter((c) => compraron.has(c.id)).length

  // Cuántos pidieron más de una vez este mes: es la señal de que vuelven.
  const vecesPorCliente = new Map<string, number>()
  for (const pedido of pedidosDelMes) {
    vecesPorCliente.set(pedido.cliente_id, (vecesPorCliente.get(pedido.cliente_id) ?? 0) + 1)
  }

  return {
    nuevos_este_mes: nuevos.length,
    escribieron_sin_comprar: nuevos.length - nuevosQueCompraron,
    conversion_pct:
      nuevos.length > 0 ? redondear((nuevosQueCompraron / nuevos.length) * 100) : null,
    recurrentes: [...vecesPorCliente.values()].filter((veces) => veces > 1).length,
  }
}

export async function comoVamos(ahora = new Date()): Promise<ComoVamos> {
  const esteMes = mesDe(ahora)
  const mesPasado = mesDe(ahora, -1)

  const [pedidosMes, pedidosAnterior, prendas] = await Promise.all([
    pedidosEntre(esteMes),
    pedidosEntre(mesPasado),
    prendasTop(esteMes),
  ])

  const actual = movimiento(pedidosMes, esteMes)
  const anterior = movimiento(pedidosAnterior, mesPasado)

  return {
    mes_en_curso: actual,
    mes_anterior: anterior,
    // Sin mes anterior no hay con qué comparar; un 0 mentiría.
    variacion_facturado_pct:
      anterior.facturado_usd > 0
        ? redondear(
            ((actual.facturado_usd - anterior.facturado_usd) / anterior.facturado_usd) * 100,
          )
        : null,
    prendas_top: prendas,
    clientes: await clientesDelMes(esteMes, pedidosMes),
    nota: 'El mes en curso va incompleto y los montos sin verificar son estimados.',
  }
}
