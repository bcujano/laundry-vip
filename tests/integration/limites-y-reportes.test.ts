import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/webhook/route'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { listar } from '@/server/clientes/repo'
import { actualizar, obtener as obtenerConfig } from '@/server/configuracion/repo'
import { crearPedido } from '@/server/pedidos/crear'
import { generar } from '@/server/reportes/repo'
import { registrarUso, usoDeHoy } from '@/server/webhook/cost-tracking'
import { fechaDeHoy, registrarMensaje } from '@/server/webhook/rate-limit'
import { corrida } from '../util/corrida.ts'

const SECRETO = process.env.N8N_WEBHOOK_SECRET as string
const CORRIDA = corrida()
const PREFIJO = `+5939${CORRIDA}`
const OPERADOR = '+593963987124'

let limiteOriginal = 0
const clientesCreados: string[] = []

async function llamar(cuerpo: unknown) {
  const peticion = new NextRequest('http://localhost:3000/api/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-webhook-secret': SECRETO },
    body: JSON.stringify(cuerpo),
  })
  const respuesta = await POST(peticion)
  return {
    estado: respuesta.status,
    sobre: (await respuesta.json()) as { ok: boolean; data?: unknown; error?: { code: string } },
  }
}

async function crearCliente(tipo: 'clinica' | 'hotel' | 'restaurante'): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from('clientes')
    .insert({
      telefono: `${PREFIJO}${String(clientesCreados.length).padStart(2, '0')}`,
      nombre_negocio: `Negocio ${CORRIDA}`,
      tipo_negocio: tipo,
      canal_origen: 'whatsapp_agente',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  clientesCreados.push(data.id)
  return data.id
}

beforeAll(async () => {
  limiteOriginal = (await obtenerConfig()).limite_mensajes_diarios_por_telefono
})

afterAll(async () => {
  const cliente = supabaseAdmin()
  await actualizar({ limite_mensajes_diarios_por_telefono: limiteOriginal })
  for (const id of clientesCreados) {
    await cliente.from('pedidos').delete().eq('cliente_id', id)
  }
  await cliente.from('clientes').delete().like('telefono', `${PREFIJO}%`)
  await cliente.from('mensajes_diarios').delete().like('telefono', `${PREFIJO}%`)
  await cliente.from('eventos_procesados').delete().like('dedupe_key', `lim-${CORRIDA}%`)
})

describe('tope diario de mensajes', () => {
  it('pasado el tope, el siguiente mensaje se rechaza SIN ejecutar la acción', async () => {
    await actualizar({ limite_mensajes_diarios_por_telefono: 3 })
    const telefono = `${PREFIJO}99`

    for (let i = 1; i <= 3; i++) {
      const { estado } = await llamar({
        accion: 'calcular_vehiculo',
        parametros: { numero_fundas: 1 },
        telefono,
      })
      expect(estado).toBe(200)
    }

    const clave = `lim-${CORRIDA}-no-debe-entrar`
    const { estado, sobre } = await llamar({
      accion: 'registrar_evento_entrante',
      parametros: { dedupe_key: clave, tipo: 'mensaje' },
      telefono,
    })

    expect(estado).toBe(429)
    expect(sobre.error?.code).toBe('LIMITE_DIARIO_ALCANZADO')

    // Lo importante: la acción no llegó a correr.
    const { data } = await supabaseAdmin()
      .from('eventos_procesados')
      .select('id')
      .eq('dedupe_key', clave)
    expect(data).toHaveLength(0)

    await supabaseAdmin().from('mensajes_diarios').delete().eq('telefono', telefono)
  })

  it('los operadores no consumen cuota', async () => {
    await actualizar({ limite_mensajes_diarios_por_telefono: 1 })

    for (let i = 0; i < 4; i++) {
      const { estado } = await llamar({
        accion: 'calcular_vehiculo',
        parametros: { numero_fundas: 1 },
        telefono: OPERADOR,
      })
      expect(estado).toBe(200)
    }
  })

  it('el contador es por teléfono y por día de Quito', async () => {
    await actualizar({ limite_mensajes_diarios_por_telefono: 40 })
    const telefono = `${PREFIJO}98`

    const primero = await registrarMensaje(telefono)
    const segundo = await registrarMensaje(telefono)

    expect(primero.contador).toBe(1)
    expect(segundo.contador).toBe(2)
    expect(segundo.excedido).toBe(false)
    expect(fechaDeHoy()).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    await supabaseAdmin().from('mensajes_diarios').delete().eq('telefono', telefono)
  })
})

describe('alerta de costo de OpenAI', () => {
  it('avisa exactamente una vez por día', async () => {
    const hoy = fechaDeHoy()
    const cliente = supabaseAdmin()
    const { data: previo } = await cliente
      .from('uso_openai_diario')
      .select('*')
      .eq('fecha', hoy)
      .maybeSingle()

    await cliente.from('uso_openai_diario').delete().eq('fecha', hoy)

    const limite = Number((await obtenerConfig()).limite_costo_diario_openai_usd)

    const porDebajo = await registrarUso(1000, limite / 2)
    expect(porDebajo.debe_alertar).toBe(false)

    // Este cruza el techo: es el único que debe avisar.
    const cruza = await registrarUso(1000, limite)
    expect(cruza.debe_alertar).toBe(true)

    const despues = await registrarUso(1000, limite)
    expect(despues.debe_alertar).toBe(false)

    const otroMas = await registrarUso(1000, limite)
    expect(otroMas.debe_alertar).toBe(false)

    const resumen = await usoDeHoy()
    expect(resumen.tokens_dia).toBe(4000)

    // Se deja el día como estaba, para no ensuciar la contabilidad real.
    await cliente.from('uso_openai_diario').delete().eq('fecha', hoy)
    if (previo) await cliente.from('uso_openai_diario').insert(previo)
  })
})

describe('reporte de ingresos', () => {
  it('agrupa por tipo de negocio y separa lo confirmado de lo estimado', async () => {
    const clinica = await crearCliente('clinica')
    const hotel = await crearCliente('hotel')
    const items = [{ descripcion: '4 camisetas', cantidad: 4, metodo: 'agua' as const }]

    const unoClinica = await crearPedido({
      clienteId: clinica,
      canal: 'whatsapp_agente',
      tipoEntrega: 'combo',
      items,
    })
    await crearPedido({
      clienteId: clinica,
      canal: 'whatsapp_agente',
      tipoEntrega: 'combo',
      items,
    })
    await crearPedido({ clienteId: hotel, canal: 'whatsapp_agente', tipoEntrega: 'combo', items })

    // Uno de la clínica ya pasó por planta: su monto es confirmado.
    if (unoClinica.ok) {
      await supabaseAdmin()
        .from('pedidos')
        .update({ monto_confirmado_lavado: 9.0 })
        .eq('id', unoClinica.pedido.id)
    }

    const reporte = await generar({
      desde: new Date(Date.now() - 60 * 60 * 1000),
      hasta: new Date(Date.now() + 60 * 60 * 1000),
    })

    const filaClinica = reporte.por_tipo_negocio.find((f) => f.tipo_negocio === 'clinica')
    const filaHotel = reporte.por_tipo_negocio.find((f) => f.tipo_negocio === 'hotel')

    expect(filaClinica?.pedidos).toBe(2)
    expect(filaClinica?.confirmado_usd).toBe(9)
    expect(filaClinica?.estimado_usd).toBe(9)
    expect(filaHotel?.pedidos).toBe(1)
    expect(filaHotel?.estimado_usd).toBe(9)

    // El transporte se suma aparte del lavado.
    expect(filaHotel?.transporte_usd).toBe(Number((await obtenerConfig()).tarifa_combo))
    expect(reporte.pedidos_sin_verificar).toBeGreaterThanOrEqual(2)
  })

  it('no factura pedidos cancelados ni fallidos', async () => {
    const restaurante = await crearCliente('restaurante')
    const creado = await crearPedido({
      clienteId: restaurante,
      canal: 'whatsapp_agente',
      tipoEntrega: 'combo',
      items: [{ descripcion: '4 camisetas', cantidad: 4, metodo: 'agua' }],
    })
    if (!creado.ok) throw new Error('no se creó')

    await supabaseAdmin().from('pedidos').update({ estado: 'cancelado' }).eq('id', creado.pedido.id)

    const reporte = await generar({
      desde: new Date(Date.now() - 60 * 60 * 1000),
      hasta: new Date(Date.now() + 60 * 60 * 1000),
    })
    const fila = reporte.por_tipo_negocio.find((f) => f.tipo_negocio === 'restaurante')
    expect(fila).toBeUndefined()
  })

  it('el reporte por WhatsApp exige ser operador', async () => {
    const intruso = await llamar({
      accion: 'generar_reporte',
      parametros: { telefono_operador: '+593999888777' },
    })
    expect(intruso.estado).toBe(403)

    const operador = await llamar({
      accion: 'generar_reporte',
      parametros: { telefono_operador: OPERADOR },
    })
    expect(operador.estado).toBe(200)
    expect((operador.sobre.data as { por_tipo_negocio: unknown[] }).por_tipo_negocio).toBeDefined()
  })
})

describe('búsqueda de clientes', () => {
  it('encuentra por nombre parcial sin distinguir mayúsculas', async () => {
    await crearCliente('clinica')

    const minusculas = await listar({ busqueda: `negocio ${CORRIDA}` })
    const mayusculas = await listar({ busqueda: `NEGOCIO ${CORRIDA}` })
    const parcial = await listar({ busqueda: CORRIDA })

    expect(minusculas.total).toBeGreaterThan(0)
    expect(mayusculas.total).toBe(minusculas.total)
    expect(parcial.total).toBe(minusculas.total)
  })
})
