import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { POR_PAGINA, colaDeHoy, listar, obtener, ultimoDelCliente } from '@/server/pedidos/repo'
import { limitesDelDia } from '@/server/scheduling/ventana'

const CORRIDA = String(Date.now()).slice(-6)
const TELEFONO = `+5939${CORRIDA}00`
let clienteId = ''

const MS_HORA = 60 * 60 * 1000
const { desde: MEDIANOCHE } = limitesDelDia(new Date())

/** Hoy a la hora local de Quito indicada. */
function hoyALas(hora: number, minutos = 0): string {
  return new Date(MEDIANOCHE.getTime() + hora * MS_HORA + minutos * 60_000).toISOString()
}

beforeAll(async () => {
  const cliente = supabaseAdmin()
  const { data, error } = await cliente
    .from('clientes')
    .insert({
      telefono: TELEFONO,
      nombre_negocio: `Hotel Prueba ${CORRIDA}`,
      tipo_negocio: 'hotel',
      canal_origen: 'whatsapp_agente',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  clienteId = data.id

  const { error: errorPedidos } = await cliente.from('pedidos').insert([
    {
      cliente_id: clienteId,
      canal: 'whatsapp_agente',
      estado: 'nuevo',
      tipo_entrega: 'combo',
      ventana_recoleccion_inicio: hoyALas(11),
      ventana_recoleccion_fin: hoyALas(12),
      direccion_recoleccion: 'Av. Mariscal Sucre 123',
      vehiculo_sugerido: 'auto',
      numero_fundas: 3,
    },
    {
      cliente_id: clienteId,
      canal: 'whatsapp_agente',
      estado: 'recolectado',
      tipo_entrega: 'a_la_carta',
      ventana_recoleccion_inicio: hoyALas(8),
      ventana_recoleccion_fin: hoyALas(12),
      direccion_recoleccion: 'Calle de prueba 1',
      vehiculo_sugerido: 'moto',
      numero_fundas: 1,
    },
    {
      cliente_id: clienteId,
      canal: 'whatsapp_agente',
      estado: 'nuevo',
      tipo_entrega: 'combo',
      ventana_recoleccion_inicio: hoyALas(9, 30),
      ventana_recoleccion_fin: hoyALas(12),
      direccion_recoleccion: 'Calle de prueba 2',
      vehiculo_sugerido: 'moto',
      numero_fundas: 1,
    },
    {
      cliente_id: clienteId,
      canal: 'whatsapp_agente',
      estado: 'nuevo',
      tipo_entrega: 'combo',
      ventana_recoleccion_inicio: new Date(MEDIANOCHE.getTime() + 32 * MS_HORA).toISOString(),
      ventana_recoleccion_fin: new Date(MEDIANOCHE.getTime() + 36 * MS_HORA).toISOString(),
      direccion_recoleccion: 'Mañana 1',
      vehiculo_sugerido: 'moto',
      numero_fundas: 1,
    },
    // Presencial: sin dirección, sin vehículo, sin fundas. Lo exige la base.
    { cliente_id: clienteId, canal: 'presencial', estado: 'en_proceso' },
  ])
  if (errorPedidos) throw new Error(errorPedidos.message)
})

afterAll(async () => {
  const cliente = supabaseAdmin()
  await cliente.from('pedidos').delete().eq('cliente_id', clienteId)
  await cliente.from('clientes').delete().eq('id', clienteId)
})

describe('cola de hoy', () => {
  it('trae solo las recolecciones de hoy, ordenadas por hora', async () => {
    const cola = (await colaDeHoy()).filter((p) => p.cliente_id === clienteId)

    expect(cola).toHaveLength(3)
    const horas = cola.map((p) => new Date(p.ventana_recoleccion_inicio as string).getTime())
    expect(horas).toEqual([...horas].sort((a, b) => a - b))
  })

  it('deja fuera lo de mañana y lo presencial sin ventana', async () => {
    const cola = (await colaDeHoy()).filter((p) => p.cliente_id === clienteId)
    expect(cola.some((p) => p.direccion_recoleccion === 'Mañana 1')).toBe(false)
    expect(cola.some((p) => p.canal === 'presencial')).toBe(false)
  })

  it('identifica cuáles están sin atender', async () => {
    const cola = (await colaDeHoy()).filter((p) => p.cliente_id === clienteId)
    expect(cola.filter((p) => p.estado === 'nuevo')).toHaveLength(2)
  })

  it('trae el cliente para poder mostrar su nombre', async () => {
    const cola = (await colaDeHoy()).filter((p) => p.cliente_id === clienteId)
    expect(cola[0]?.cliente?.nombre_negocio).toBe(`Hotel Prueba ${CORRIDA}`)
  })
})

describe('lista de pedidos', () => {
  it('pagina de a 50', async () => {
    const resultado = await listar({ pagina: 1 })
    expect(POR_PAGINA).toBe(50)
    expect(resultado.pedidos.length).toBeLessThanOrEqual(50)
    expect(resultado.paginas).toBe(Math.max(1, Math.ceil(resultado.total / 50)))
  })

  it('filtra por estado', async () => {
    const nuevos = await listar({ estado: 'nuevo' })
    expect(nuevos.pedidos.every((p) => p.estado === 'nuevo')).toBe(true)
    expect(nuevos.pedidos.filter((p) => p.cliente_id === clienteId)).toHaveLength(3)
  })

  it('filtra por canal', async () => {
    const presenciales = await listar({ canal: 'presencial' })
    expect(presenciales.pedidos.every((p) => p.canal === 'presencial')).toBe(true)

    const mios = presenciales.pedidos.filter((p) => p.cliente_id === clienteId)
    expect(mios).toHaveLength(1)
    // Un presencial nunca tiene logística que mostrar.
    expect(mios[0]?.direccion_recoleccion).toBeNull()
    expect(mios[0]?.vehiculo_sugerido).toBeNull()
    expect(mios[0]?.numero_fundas).toBeNull()
  })

  it('combina los dos filtros', async () => {
    const resultado = await listar({ estado: 'en_proceso', canal: 'presencial' })
    expect(
      resultado.pedidos.every((p) => p.estado === 'en_proceso' && p.canal === 'presencial'),
    ).toBe(true)
  })
})

describe('detalle de pedido', () => {
  it('devuelve el pedido con sus colecciones vacías si aún no tiene', async () => {
    const ultimo = await ultimoDelCliente(clienteId)
    expect(ultimo).not.toBeNull()

    const completo = await obtener(ultimo?.id as string)
    expect(completo?.pedido.id).toBe(ultimo?.id)
    expect(Array.isArray(completo?.items)).toBe(true)
    expect(Array.isArray(completo?.eventos)).toBe(true)
  })

  it('devuelve null si el pedido no existe', async () => {
    expect(await obtener('11111111-1111-4111-8111-111111111111')).toBeNull()
  })
})
