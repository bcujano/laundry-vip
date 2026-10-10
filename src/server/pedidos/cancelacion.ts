import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener } from '@/server/configuracion/repo'
import type { EstadoPedido, Pedido } from '@/types/database'
import { leerPedido, type Resultado } from './comun'

/** Estados en los que la lavandería ya tiene la ropa en su poder. */
const ROPA_RECOGIDA: readonly EstadoPedido[] = [
  'recolectado',
  'en_proceso',
  'esperando_pago_para_entrega',
  'listo_para_entrega',
  'discrepancia_detectada',
]

/**
 * Cuánto se cobra por cancelar. Un tramo si el cliente retira su ropa en planta, dos si pide
 * que se la devuelvan. Sin cargo si la ropa no se recogió o si el cliente la traía él mismo.
 */
export function calcularCancelacion(
  pedido: Pick<Pedido, 'estado' | 'tipo_entrega' | 'metodo_transporte_recoleccion'>,
  conDevolucion: boolean,
  tarifaPorTramo: number,
): number | null {
  if (!ROPA_RECOGIDA.includes(pedido.estado)) return null
  // «combo» = la lavandería recoge y entrega; en «a la carta» solo si ese tramo lo hace la app.
  const recogeLaLavanderia =
    pedido.tipo_entrega === 'combo' || pedido.metodo_transporte_recoleccion === 'app'
  if (!recogeLaLavanderia) return null
  const tramos = conDevolucion ? 2 : 1
  return Math.round(tarifaPorTramo * tramos * 100) / 100
}

/** Se llama justo antes de pasar el pedido a «cancelado», con el estado anterior todavía puesto. */
export async function cargoAlCancelar(pedido: Pedido): Promise<number | null> {
  const config = await obtener()
  return calcularCancelacion(pedido, false, Number(config.tarifa_recoleccion_entrega))
}

/** «El cliente pidió que le devuelvan la ropa»: el cargo pasa de un tramo a dos. */
export async function pedirDevolucionTrasCancelar(
  pedidoId: string,
): Promise<Resultado<{ monto: number }>> {
  const pedido = await leerPedido(pedidoId)
  if (!pedido) return { ok: false, error: 'El pedido no existe.' }
  if (pedido.estado !== 'cancelado' || pedido.monto_cancelacion === null) {
    return { ok: false, error: 'Solo aplica a un pedido cancelado con la ropa ya recogida.' }
  }
  const config = await obtener()
  const monto = Math.round(Number(config.tarifa_recoleccion_entrega) * 2 * 100) / 100
  const { error } = await supabaseAdmin()
    .from('pedidos')
    .update({ monto_cancelacion: monto, cancelacion_con_devolucion: true })
    .eq('id', pedidoId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, datos: { monto } }
}
