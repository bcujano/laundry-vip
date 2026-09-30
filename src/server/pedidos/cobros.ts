import { supabaseAdmin } from '@/lib/supabase/admin'
import { crearAvisoDiscrepancia } from '@/server/avisos/repo'
import type { EstadoPedido } from '@/types/database'
import { type Contexto, leerPedido, type Resultado, registrarEvento } from './comun'

export type Tramo = 'recoleccion' | 'entrega' | 'lavado'

/**
 * Nunca se despacha un tramo "app" sin su pago confirmado. Confirmar el pago
 * es justo lo que libera el despacho de ese tramo.
 */
export async function confirmarPago(
  pedidoId: string,
  tramo: Tramo,
  contexto: Contexto,
): Promise<Resultado<{ estado: EstadoPedido; despachoLiberado: boolean }>> {
  const pedido = await leerPedido(pedidoId)
  if (!pedido) return { ok: false, error: 'El pedido no existe.' }

  const cambios: Record<string, unknown> = {}
  let nuevoEstado = pedido.estado
  let despachoLiberado = false

  if (tramo === 'recoleccion') {
    if (pedido.metodo_transporte_recoleccion !== 'app') {
      return { ok: false, error: 'Ese tramo no se paga: no lo gestiona la lavandería.' }
    }
    cambios.pago_recoleccion = 'pagado'
    if (pedido.estado === 'esperando_pago_para_recoleccion') {
      nuevoEstado = 'nuevo'
      despachoLiberado = true
    }
  } else if (tramo === 'entrega') {
    if (pedido.metodo_transporte_entrega !== 'app') {
      return { ok: false, error: 'Ese tramo no se paga: no lo gestiona la lavandería.' }
    }
    cambios.pago_entrega = 'pagado'
    if (pedido.estado === 'esperando_pago_para_entrega') {
      nuevoEstado = 'listo_para_entrega'
      despachoLiberado = true
    }
  } else {
    cambios.pago_lavado = 'pagado'
  }

  cambios.estado = nuevoEstado
  const { error } = await supabaseAdmin().from('pedidos').update(cambios).eq('id', pedidoId)
  if (error) return { ok: false, error: error.message }

  if (nuevoEstado !== pedido.estado) {
    await registrarEvento(pedidoId, pedido.estado, nuevoEstado, {
      ...contexto,
      motivo: `Pago de ${tramo} confirmado`,
    })
  }

  return { ok: true, datos: { estado: nuevoEstado, despachoLiberado } }
}

export type ResultadoCorreccion = {
  montoAnterior: number
  montoCorregido: number
  /** n8n avisa al cliente el motivo ANTES de pedirle el pago. */
  notificarCliente: true
}

/**
 * Corrige el monto del lavado. Siempre deja rastro en correcciones_cotizacion
 * con el monto vigente como anterior, marca discrepancia y congela el pedido
 * hasta que el cliente confirme o un operador lo cierre. El monto original del
 * agente nunca se cobra si un humano lo corrigió.
 */
export async function corregirCotizacion(
  pedidoId: string,
  montoCorregido: number,
  motivo: string,
  contexto: Contexto,
): Promise<Resultado<ResultadoCorreccion>> {
  if (!Number.isFinite(montoCorregido) || montoCorregido < 0) {
    return { ok: false, error: 'El monto corregido no puede ser negativo.' }
  }
  if (motivo.trim() === '') {
    return { ok: false, error: 'Una corrección sin motivo no se puede explicar al cliente.' }
  }

  const cliente = supabaseAdmin()
  const pedido = await leerPedido(pedidoId)
  if (!pedido) return { ok: false, error: 'El pedido no existe.' }

  // El monto vigente es el confirmado si ya lo hay; si no, el estimado.
  const montoAnterior = Number(pedido.monto_confirmado_lavado ?? pedido.monto_estimado_lavado ?? 0)

  const { error: errorAuditoria } = await cliente.from('correcciones_cotizacion').insert({
    pedido_id: pedidoId,
    monto_anterior: montoAnterior,
    monto_corregido: montoCorregido,
    motivo: motivo.trim(),
    corregido_por_staff_id: contexto.staffId ?? null,
    notificado_cliente: false,
  })
  if (errorAuditoria) return { ok: false, error: errorAuditoria.message }

  const { error } = await cliente
    .from('pedidos')
    .update({
      monto_confirmado_lavado: montoCorregido,
      estado: 'discrepancia_detectada',
      discrepancia_detectada: true,
      discrepancia_motivo: motivo.trim(),
    })
    .eq('id', pedidoId)
  if (error) return { ok: false, error: error.message }

  await registrarEvento(pedidoId, pedido.estado, 'discrepancia_detectada', {
    ...contexto,
    motivo: `Cotización corregida: ${motivo.trim()}`,
  })

  await crearAvisoDiscrepancia(pedidoId, {
    tipo: 'correccion_monto',
    montoAnterior,
    montoNuevo: montoCorregido,
    motivo: motivo.trim(),
  })

  return { ok: true, datos: { montoAnterior, montoCorregido, notificarCliente: true } }
}

/** Cierra la discrepancia: el cliente aceptó o el operador la resolvió. */
export async function resolverDiscrepancia(
  pedidoId: string,
  contexto: Contexto,
): Promise<Resultado<{ estado: EstadoPedido }>> {
  const cliente = supabaseAdmin()
  const pedido = await leerPedido(pedidoId)
  if (!pedido) return { ok: false, error: 'El pedido no existe.' }
  if (!pedido.discrepancia_detectada) {
    return { ok: false, error: 'Este pedido no tiene ninguna discrepancia abierta.' }
  }

  const { error } = await cliente
    .from('pedidos')
    .update({ estado: 'en_proceso', discrepancia_detectada: false, pago_lavado: 'confirmado' })
    .eq('id', pedidoId)
  if (error) return { ok: false, error: error.message }

  await cliente
    .from('correcciones_cotizacion')
    .update({ notificado_cliente: true })
    .eq('pedido_id', pedidoId)
    .eq('notificado_cliente', false)

  await registrarEvento(pedidoId, pedido.estado, 'en_proceso', {
    ...contexto,
    motivo: contexto.motivo ?? 'Discrepancia aceptada por el cliente',
  })

  return { ok: true, datos: { estado: 'en_proceso' } }
}
