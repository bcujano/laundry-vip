import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import { limitesDelDia } from '@/server/scheduling/ventana'

/**
 * Tope diario de mensajes por teléfono. Protege del bucle infinito y del
 * abuso: un número solo puede consumir tantos turnos del agente por día.
 */

/** La fecha de hoy en Quito, no en UTC: el día cambia a medianoche de aquí. */
export function fechaDeHoy(ahora = new Date()): string {
  return limitesDelDia(ahora).desde.toISOString().slice(0, 10)
}

export type ResultadoLimite = {
  contador: number
  limite: number
  excedido: boolean
}

/**
 * Cuenta un mensaje y dice si ese teléfono ya pasó el tope.
 * Se cuenta ANTES de ejecutar la acción; si excede, la acción no corre.
 */
export async function registrarMensaje(
  telefono: string,
  ahora = new Date(),
): Promise<ResultadoLimite> {
  const config = await obtenerConfig()
  const limite = config.limite_mensajes_diarios_por_telefono
  const fecha = fechaDeHoy(ahora)
  const cliente = supabaseAdmin()

  const { data: existente } = await cliente
    .from('mensajes_diarios')
    .select('contador')
    .eq('telefono', telefono)
    .eq('fecha', fecha)
    .maybeSingle()

  const contador = (existente?.contador ?? 0) + 1

  await cliente
    .from('mensajes_diarios')
    .upsert({ telefono, fecha, contador }, { onConflict: 'telefono,fecha' })

  return { contador, limite, excedido: contador > limite }
}

/** Cuántos mensajes lleva hoy, sin contarle uno nuevo. */
export async function consultarContador(telefono: string, ahora = new Date()): Promise<number> {
  const { data } = await supabaseAdmin()
    .from('mensajes_diarios')
    .select('contador')
    .eq('telefono', telefono)
    .eq('fecha', fechaDeHoy(ahora))
    .maybeSingle()

  return data?.contador ?? 0
}

/** Los operadores no consumen cuota: son la casa. */
export async function esOperadorConocido(telefono: string): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from('operador_whitelist')
    .select('id')
    .eq('telefono', telefono)
    .eq('activo', true)
    .maybeSingle()

  return data !== null
}
