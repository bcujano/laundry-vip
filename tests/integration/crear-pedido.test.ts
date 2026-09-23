import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import { crearPedido } from '@/server/pedidos/crear'
import { consultarEstadoPorTelefono } from '@/server/webhook/handlers/pedidos'
import type { Cliente } from '@/types/database'
import { corrida } from '../util/corrida.ts'

const CORRIDA = corrida()
const PREFIJO = `+5939${CORRIDA}`
const ITEMS = [{ descripcion: '3 camisetas', cantidad: 3, metodo: 'agua' as const }]

const creados: string[] = []

async function crearCliente(
  modelo: 'por_pedido' | 'consolidado_mensual' = 'por_pedido',
): Promise<Cliente> {
  const telefono = `${PREFIJO}${String(creados.length).padStart(2, '0')}`
  const { data, error } = await supabaseAdmin()
    .from('clientes')
    .insert({
      telefono,
      nombre_negocio: `Prueba ${CORRIDA}`,
      canal_origen: 'whatsapp_agente',
      modelo_facturacion: modelo,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  creados.push(data.id)
  return data as Cliente
}

afterAll(async () => {
  const cliente = supabaseAdmin()
  for (const id of creados) {
    await cliente.from('pedidos').delete().eq('cliente_id', id)
  }
  await cliente.from('clientes').delete().like('telefono', `${PREFIJO}%`)
})

describe('matriz de pagos', () => {
  it('combo toma la tarifa vigente y nace en nuevo', async () => {
    const cliente = await crearCliente()
    const config = await obtenerConfig()

    const resultado = await crearPedido({
      clienteId: cliente.id,
      canal: 'whatsapp_agente',
      tipoEntrega: 'combo',
      items: ITEMS,
      numeroFundas: 2,
      direccionRecoleccion: 'Av. Mariscal Sucre 123',
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(Number(resultado.pedido.monto_recoleccion_entrega)).toBe(
      Number(config.tarifa_recoleccion_entrega),
    )
    expect(resultado.pedido.estado).toBe('nuevo')
    expect(resultado.pedido.vehiculo_sugerido).toBe('auto')
    expect(Number(resultado.montoEstimadoLavado)).toBe(6.75)
  })

  it('a la carta con un tramo por app nace esperando ese pago', async () => {
    const cliente = await crearCliente()

    const resultado = await crearPedido({
      clienteId: cliente.id,
      canal: 'whatsapp_agente',
      tipoEntrega: 'a_la_carta',
      items: ITEMS,
      metodoRecoleccion: 'app',
      metodoEntrega: 'propio_cliente',
      montoRecoleccion: 3.4,
      numeroFundas: 1,
      direccionRecoleccion: 'Calle 1',
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.pedido.estado).toBe('esperando_pago_para_recoleccion')
    expect(resultado.pedido.pago_recoleccion).toBe('pendiente')
    // El tramo del propio cliente no bloquea: la lavandería no lo gestiona.
    expect(resultado.pedido.pago_entrega).toBe('n_a')
    expect(Number(resultado.pedido.monto_recoleccion)).toBe(3.4)
    expect(resultado.pedido.monto_entrega).toBeNull()
    expect(resultado.pedido.vehiculo_sugerido).toBe('moto')
  })

  it('a la carta con los dos tramos del cliente no bloquea nada', async () => {
    const cliente = await crearCliente()

    const resultado = await crearPedido({
      clienteId: cliente.id,
      canal: 'whatsapp_agente',
      tipoEntrega: 'a_la_carta',
      items: ITEMS,
      metodoRecoleccion: 'propio_cliente',
      metodoEntrega: 'propio_cliente',
      numeroFundas: 1,
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.pedido.estado).toBe('nuevo')
  })

  it('el cliente consolidado_mensual NUNCA nace esperando pago', async () => {
    const cliente = await crearCliente('consolidado_mensual')

    const resultado = await crearPedido({
      clienteId: cliente.id,
      canal: 'whatsapp_agente',
      tipoEntrega: 'a_la_carta',
      items: ITEMS,
      // Los dos tramos por app: sin la excepción, esto bloquearía.
      metodoRecoleccion: 'app',
      metodoEntrega: 'app',
      montoRecoleccion: 3.4,
      montoEntrega: 3.9,
      numeroFundas: 2,
      direccionRecoleccion: 'Calle 2',
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.pedido.estado).toBe('nuevo')
    expect(resultado.pedido.pago_lavado).toBe('acumulado_mensual')
  })
})

describe('pedido presencial', () => {
  it('nace sin nada de logística', async () => {
    const cliente = await crearCliente()

    const resultado = await crearPedido({
      clienteId: cliente.id,
      canal: 'presencial',
      items: ITEMS,
      // Aunque se manden, se ignoran: un presencial no tiene logística.
      numeroFundas: 3,
      direccionRecoleccion: 'No debería guardarse',
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.pedido.direccion_recoleccion).toBeNull()
    expect(resultado.pedido.vehiculo_sugerido).toBeNull()
    expect(resultado.pedido.numero_fundas).toBeNull()
    expect(resultado.pedido.tipo_entrega).toBeNull()
    expect(resultado.pedido.ventana_recoleccion_inicio).toBeNull()
  })
})

describe('las prendas y el primer evento', () => {
  it('guarda las prendas con el precio del catálogo, no con el que llegue', async () => {
    const cliente = await crearCliente()
    const resultado = await crearPedido({
      clienteId: cliente.id,
      canal: 'whatsapp_agente',
      tipoEntrega: 'combo',
      items: [
        { descripcion: '3 camisetas', cantidad: 3, metodo: 'agua' },
        { descripcion: 'un kayak inflable', cantidad: 1 },
      ],
    })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    const { data: prendas } = await supabaseAdmin()
      .from('pedido_items')
      .select('*')
      .eq('pedido_id', resultado.pedido.id)

    expect(prendas).toHaveLength(2)

    const camiseta = prendas?.find((p) => p.descripcion === 'Camiseta')
    expect(Number(camiseta?.precio_unitario)).toBe(2.25)
    expect(camiseta?.no_reconocido).toBe(false)

    // Lo que no está en el catálogo entra marcado y sin precio.
    const kayak = prendas?.find((p) => p.no_reconocido === true)
    expect(kayak?.precio_unitario).toBeNull()
    expect(Number(resultado.pedido.monto_estimado_lavado)).toBe(6.75)
  })

  it('deja su primer evento en la línea de tiempo', async () => {
    const cliente = await crearCliente()
    const resultado = await crearPedido({
      clienteId: cliente.id,
      canal: 'whatsapp_agente',
      tipoEntrega: 'combo',
      items: ITEMS,
    })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    const { data: eventos } = await supabaseAdmin()
      .from('pedido_eventos')
      .select('*')
      .eq('pedido_id', resultado.pedido.id)

    expect(eventos).toHaveLength(1)
    expect(eventos?.[0]?.estado_anterior).toBeNull()
    expect(eventos?.[0]?.estado_nuevo).toBe('nuevo')
    expect(eventos?.[0]?.actor).toBe('agente')
  })

  it('agenda la ventana siguiente si no le dan una', async () => {
    const cliente = await crearCliente()
    const resultado = await crearPedido({
      clienteId: cliente.id,
      canal: 'whatsapp_agente',
      tipoEntrega: 'combo',
      items: ITEMS,
    })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    const inicio = new Date(resultado.pedido.ventana_recoleccion_inicio as string)
    expect(inicio.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('errores', () => {
  it('cliente inexistente: NO_ENCONTRADO', async () => {
    const resultado = await crearPedido({
      clienteId: '11111111-1111-4111-8111-111111111111',
      canal: 'whatsapp_agente',
      tipoEntrega: 'combo',
      items: ITEMS,
    })
    expect(resultado).toMatchObject({ ok: false, codigo: 'NO_ENCONTRADO' })
  })

  it('sin prendas: ITEMS_VACIOS', async () => {
    const cliente = await crearCliente()
    const resultado = await crearPedido({
      clienteId: cliente.id,
      canal: 'whatsapp_agente',
      tipoEntrega: 'combo',
      items: [],
    })
    expect(resultado).toMatchObject({ ok: false, codigo: 'ITEMS_VACIOS' })
  })

  it('por WhatsApp sin tipo_entrega: PARAMETROS_INVALIDOS', async () => {
    const cliente = await crearCliente()
    const resultado = await crearPedido({
      clienteId: cliente.id,
      canal: 'whatsapp_agente',
      items: ITEMS,
    })
    expect(resultado).toMatchObject({ ok: false, codigo: 'PARAMETROS_INVALIDOS' })
  })
})

describe('consultar el estado', () => {
  it('devuelve el pedido más reciente de ese teléfono', async () => {
    const cliente = await crearCliente()

    const primero = await crearPedido({
      clienteId: cliente.id,
      canal: 'whatsapp_agente',
      tipoEntrega: 'combo',
      items: ITEMS,
    })
    // Separación mínima para que el orden por created_at sea inequívoco.
    await new Promise((resolver) => setTimeout(resolver, 1100))
    const segundo = await crearPedido({
      clienteId: cliente.id,
      canal: 'whatsapp_agente',
      tipoEntrega: 'a_la_carta',
      items: ITEMS,
      metodoRecoleccion: 'propio_cliente',
    })

    expect(primero.ok && segundo.ok).toBe(true)
    if (!primero.ok || !segundo.ok) return

    const resultado = await consultarEstadoPorTelefono({ telefono: cliente.telefono })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    const data = resultado.data as { pedido_id: string; tipo_entrega: string }
    expect(data.pedido_id).toBe(segundo.pedido.id)
    expect(data.tipo_entrega).toBe('a_la_carta')
  })

  it('un teléfono desconocido no encuentra nada, sin romperse', async () => {
    const resultado = await consultarEstadoPorTelefono({ telefono: '+593000000999' })
    expect(resultado).toMatchObject({ ok: false, codigo: 'NO_ENCONTRADO' })
  })
})
