import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { confirmarPago, corregirCotizacion, resolverDiscrepancia } from '@/server/pedidos/cobros'
import { avanzarEstado } from '@/server/pedidos/estado'
import { verificarConteo } from '@/server/pedidos/verificacion'
import { corrida } from '../util/corrida.ts'

const CORRIDA = corrida()
const TELEFONO = `+5939${CORRIDA}11`
const CONTEXTO = { actor: 'operador' as const, staffId: null }

let clienteId = ''

/** Pedido recolectado con 5 camisetas a 2.25 declaradas: 11.25 estimados. */
async function crearPedidoConPrendas(extra: Record<string, unknown> = {}) {
  const cliente = supabaseAdmin()

  if (!clienteId) {
    const { data, error } = await cliente
      .from('clientes')
      .insert({
        telefono: TELEFONO,
        nombre_negocio: `Prueba ${CORRIDA}`,
        canal_origen: 'whatsapp_agente',
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    clienteId = data.id
  }

  const { data: pedido, error } = await cliente
    .from('pedidos')
    .insert({
      cliente_id: clienteId,
      canal: 'whatsapp_agente',
      estado: 'recolectado',
      tipo_entrega: 'combo',
      monto_estimado_lavado: 11.25,
      pago_lavado: 'estimado',
      ...extra,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  const { data: item, error: errorItem } = await cliente
    .from('pedido_items')
    .insert({
      pedido_id: pedido.id,
      origen: 'declarado',
      descripcion: 'Camiseta (agua)',
      cantidad: 5,
      precio_unitario: 2.25,
      subtotal: 11.25,
    })
    .select('id')
    .single()
  if (errorItem) throw new Error(errorItem.message)

  return { pedidoId: pedido.id as string, itemId: item.id as string }
}

async function estadoDe(pedidoId: string) {
  const { data } = await supabaseAdmin().from('pedidos').select('*').eq('id', pedidoId).single()
  return data as Record<string, unknown>
}

afterAll(async () => {
  const cliente = supabaseAdmin()
  await cliente.from('pedidos').delete().eq('cliente_id', clienteId)
  await cliente.from('clientes').delete().eq('id', clienteId)
})

describe('verificación del conteo en planta', () => {
  it('si el conteo cuadra, el pedido avanza solo a en_proceso', async () => {
    const { pedidoId, itemId } = await crearPedidoConPrendas()

    const resultado = await verificarConteo(
      pedidoId,
      [{ itemDeclaradoId: itemId, cantidadReal: 5 }],
      CONTEXTO,
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.datos.hayDiscrepancia).toBe(false)
    expect(resultado.datos.montoConfirmado).toBe(11.25)

    const pedido = await estadoDe(pedidoId)
    expect(pedido.estado).toBe('en_proceso')
    expect(pedido.discrepancia_detectada).toBe(false)
    expect(pedido.pago_lavado).toBe('confirmado')
  })

  it('si el conteo NO cuadra, marca discrepancia y NO avanza a en_proceso', async () => {
    const { pedidoId, itemId } = await crearPedidoConPrendas()

    const resultado = await verificarConteo(
      pedidoId,
      [{ itemDeclaradoId: itemId, cantidadReal: 7 }],
      CONTEXTO,
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.datos.hayDiscrepancia).toBe(true)
    expect(resultado.datos.diferencias).toEqual([
      { descripcion: 'Camiseta (agua)', declarada: 5, real: 7 },
    ])

    const pedido = await estadoDe(pedidoId)
    expect(pedido.estado).toBe('discrepancia_detectada')
    expect(pedido.estado).not.toBe('en_proceso')
    expect(pedido.discrepancia_detectada).toBe(true)
    // El monto se recalcula, pero NO se da por confirmado el cobro.
    expect(Number(pedido.monto_confirmado_lavado)).toBe(15.75)
    expect(pedido.pago_lavado).toBe('estimado')
    expect(String(pedido.discrepancia_motivo)).toContain('declaradas 5, contadas 7')
  })

  it('una discrepancia abierta congela el pedido', async () => {
    const { pedidoId, itemId } = await crearPedidoConPrendas()
    await verificarConteo(pedidoId, [{ itemDeclaradoId: itemId, cantidadReal: 2 }], CONTEXTO)

    const intento = await avanzarEstado(pedidoId, 'listo_para_entrega', CONTEXTO)
    expect(intento.ok).toBe(false)
    if (!intento.ok) expect(intento.error).toContain('discrepancia abierta')

    // Cancelar sí se permite: es la salida de emergencia.
    expect((await avanzarEstado(pedidoId, 'cancelado', CONTEXTO)).ok).toBe(true)
  })

  it('recontar no acumula filas verificadas', async () => {
    const { pedidoId, itemId } = await crearPedidoConPrendas()
    await verificarConteo(pedidoId, [{ itemDeclaradoId: itemId, cantidadReal: 7 }], CONTEXTO)
    await verificarConteo(pedidoId, [{ itemDeclaradoId: itemId, cantidadReal: 5 }], CONTEXTO)

    const { data } = await supabaseAdmin()
      .from('pedido_items')
      .select('id')
      .eq('pedido_id', pedidoId)
      .eq('origen', 'verificado')

    expect(data).toHaveLength(1)
    expect((await estadoDe(pedidoId)).estado).toBe('en_proceso')
  })

  it('exige contar todas las prendas declaradas', async () => {
    const { pedidoId } = await crearPedidoConPrendas()
    const resultado = await verificarConteo(pedidoId, [], CONTEXTO)
    expect(resultado.ok).toBe(false)
  })
})

describe('pagos', () => {
  it('el pago confirmado libera el despacho de recolección', async () => {
    const { pedidoId } = await crearPedidoConPrendas({
      estado: 'esperando_pago_para_recoleccion',
      metodo_transporte_recoleccion: 'app',
      pago_recoleccion: 'pendiente',
      monto_recoleccion: 3.5,
    })

    const resultado = await confirmarPago(pedidoId, 'recoleccion', CONTEXTO)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.datos.despachoLiberado).toBe(true)

    const pedido = await estadoDe(pedidoId)
    expect(pedido.pago_recoleccion).toBe('pagado')
    expect(pedido.estado).toBe('nuevo')
  })

  it('no deja pagar un tramo que la lavandería no gestiona', async () => {
    const { pedidoId } = await crearPedidoConPrendas({
      metodo_transporte_recoleccion: 'propio_cliente',
    })
    const resultado = await confirmarPago(pedidoId, 'recoleccion', CONTEXTO)
    expect(resultado.ok).toBe(false)
  })
})

describe('corrección de cotización', () => {
  it('deja fila de auditoría, bloquea el avance y pide notificar al cliente', async () => {
    const { pedidoId } = await crearPedidoConPrendas()

    const resultado = await corregirCotizacion(pedidoId, 14.0, 'Vino una chompa extra', CONTEXTO)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.datos.montoAnterior).toBe(11.25)
    expect(resultado.datos.notificarCliente).toBe(true)

    const { data: auditoria } = await supabaseAdmin()
      .from('correcciones_cotizacion')
      .select('*')
      .eq('pedido_id', pedidoId)

    expect(auditoria).toHaveLength(1)
    expect(Number(auditoria?.[0]?.monto_anterior)).toBe(11.25)
    expect(Number(auditoria?.[0]?.monto_corregido)).toBe(14)
    expect(auditoria?.[0]?.notificado_cliente).toBe(false)

    const pedido = await estadoDe(pedidoId)
    expect(pedido.estado).toBe('discrepancia_detectada')
    expect(Number(pedido.monto_confirmado_lavado)).toBe(14)

    // El monto viejo ya no se puede cobrar: el avance queda bloqueado.
    expect((await avanzarEstado(pedidoId, 'listo_para_entrega', CONTEXTO)).ok).toBe(false)
  })

  it('exige un motivo: hay que poder explicárselo al cliente', async () => {
    const { pedidoId } = await crearPedidoConPrendas()
    expect((await corregirCotizacion(pedidoId, 14, '   ', CONTEXTO)).ok).toBe(false)
    expect((await corregirCotizacion(pedidoId, -5, 'motivo', CONTEXTO)).ok).toBe(false)
  })

  it('resolver la discrepancia desbloquea y marca al cliente como avisado', async () => {
    const { pedidoId } = await crearPedidoConPrendas()
    await corregirCotizacion(pedidoId, 14.0, 'Vino una chompa extra', CONTEXTO)

    const resultado = await resolverDiscrepancia(pedidoId, CONTEXTO)
    expect(resultado.ok).toBe(true)

    const pedido = await estadoDe(pedidoId)
    expect(pedido.estado).toBe('en_proceso')
    expect(pedido.discrepancia_detectada).toBe(false)

    const { data } = await supabaseAdmin()
      .from('correcciones_cotizacion')
      .select('notificado_cliente')
      .eq('pedido_id', pedidoId)
    expect(data?.[0]?.notificado_cliente).toBe(true)
  })
})

describe('línea de tiempo', () => {
  it('cada cambio de estado deja su evento', async () => {
    const { pedidoId, itemId } = await crearPedidoConPrendas()
    await verificarConteo(pedidoId, [{ itemDeclaradoId: itemId, cantidadReal: 5 }], CONTEXTO)
    await avanzarEstado(pedidoId, 'listo_para_entrega', CONTEXTO)

    const { data } = await supabaseAdmin()
      .from('pedido_eventos')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('created_at')

    expect(data?.length).toBeGreaterThanOrEqual(2)
    expect(data?.map((e) => e.estado_nuevo)).toContain('en_proceso')
    expect(data?.map((e) => e.estado_nuevo)).toContain('listo_para_entrega')
  })
})
