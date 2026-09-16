import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ActorEvento, EstadoPedido, Pedido } from '@/types/database'

export type Resultado<T = undefined> =
  | ({ ok: true } & (T extends undefined ? Record<never, never> : { datos: T }))
  | { ok: false; error: string }

export type Contexto = { actor: ActorEvento; staffId?: string | null; motivo?: string }

/** Deja constancia de cada cambio de estado: la línea de tiempo del pedido. */
export async function registrarEvento(
  pedidoId: string,
  anterior: EstadoPedido | null,
  nuevo: EstadoPedido,
  contexto: Contexto,
): Promise<void> {
  await supabaseAdmin()
    .from('pedido_eventos')
    .insert({
      pedido_id: pedidoId,
      estado_anterior: anterior,
      estado_nuevo: nuevo,
      actor: contexto.actor,
      staff_id: contexto.staffId ?? null,
      motivo: contexto.motivo ?? null,
    })
}

export async function leerPedido(pedidoId: string): Promise<Pedido | null> {
  const { data } = await supabaseAdmin()
    .from('pedidos')
    .select('*')
    .eq('id', pedidoId)
    .maybeSingle()
  return (data as Pedido | null) ?? null
}
