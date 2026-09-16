import { supabaseAdmin } from '@/lib/supabase/admin'
import { ESTADOS_PEDIDO, type EstadoPedido } from '@/types/database'
import { type Contexto, leerPedido, type Resultado, registrarEvento } from './comun'

/** Estados desde los que se puede pasar a cada uno. Lo que no está, no se puede. */
const TRANSICIONES: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
  recolectado: ['nuevo', 'esperando_pago_para_recoleccion'],
  en_proceso: ['recolectado', 'discrepancia_detectada'],
  esperando_pago_para_entrega: ['en_proceso'],
  listo_para_entrega: ['en_proceso', 'esperando_pago_para_entrega'],
  entregado: ['listo_para_entrega'],
  recoleccion_fallida: ['nuevo', 'esperando_pago_para_recoleccion'],
  // Cancelar se puede desde casi cualquier punto: es la salida de emergencia,
  // y un pedido congelado por discrepancia tiene que poder cerrarse.
  cancelado: ESTADOS_PEDIDO.filter(
    (estado) => estado !== 'entregado' && estado !== 'cancelado',
  ) as EstadoPedido[],
}

/**
 * Avance manual desde el CRM. Una discrepancia abierta congela el pedido: solo
 * se puede cancelar o resolver la discrepancia, nunca seguir adelante.
 */
export async function avanzarEstado(
  pedidoId: string,
  destino: EstadoPedido,
  contexto: Contexto,
): Promise<Resultado<{ estado: EstadoPedido }>> {
  const pedido = await leerPedido(pedidoId)
  if (!pedido) return { ok: false, error: 'El pedido no existe.' }
  if (pedido.estado === destino) return { ok: true, datos: { estado: destino } }

  if (pedido.discrepancia_detectada && destino !== 'cancelado') {
    return {
      ok: false,
      error: 'El pedido tiene una discrepancia abierta: resuélvela antes de avanzar.',
    }
  }

  const permitidos = TRANSICIONES[destino] ?? []
  if (!permitidos.includes(pedido.estado)) {
    return { ok: false, error: `No se puede pasar de "${pedido.estado}" a "${destino}".` }
  }

  const { error } = await supabaseAdmin()
    .from('pedidos')
    .update({ estado: destino })
    .eq('id', pedidoId)
  if (error) return { ok: false, error: error.message }

  await registrarEvento(pedidoId, pedido.estado, destino, contexto)
  return { ok: true, datos: { estado: destino } }
}
