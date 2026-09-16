import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import { fechaDeHoy } from './rate-limit'

/**
 * Gasto diario de OpenAI. El agente en n8n reporta cuánto consumió cada turno
 * y aquí se acumula. Cuando el acumulado pasa el techo configurable se avisa
 * UNA sola vez por día: una alerta que se repite deja de leerse.
 */

export type ResultadoUso = {
  tokens_dia: number
  costo_dia_usd: number
  limite_usd: number
  /** true solo en la llamada que cruza el techo; después ya no. */
  debe_alertar: boolean
}

export async function registrarUso(
  tokens: number,
  costoUsd: number,
  ahora = new Date(),
): Promise<ResultadoUso> {
  const config = await obtenerConfig()
  const limite = Number(config.limite_costo_diario_openai_usd)
  const fecha = fechaDeHoy(ahora)
  const cliente = supabaseAdmin()

  const { data: existente } = await cliente
    .from('uso_openai_diario')
    .select('*')
    .eq('fecha', fecha)
    .maybeSingle()

  const tokensDia = Number(existente?.tokens ?? 0) + Math.max(0, tokens)
  const costoDia = Number(existente?.costo_estimado_usd ?? 0) + Math.max(0, costoUsd)
  const yaAvisado = existente?.alerta_enviada === true

  // Se cruza el techo y todavía nadie avisó: esta es la única llamada que
  // devuelve debe_alertar en todo el día.
  const debeAlertar = costoDia > limite && !yaAvisado

  await cliente.from('uso_openai_diario').upsert(
    {
      fecha,
      tokens: tokensDia,
      costo_estimado_usd: Number(costoDia.toFixed(4)),
      alerta_enviada: yaAvisado || debeAlertar,
    },
    { onConflict: 'fecha' },
  )

  return {
    tokens_dia: tokensDia,
    costo_dia_usd: Number(costoDia.toFixed(4)),
    limite_usd: limite,
    debe_alertar: debeAlertar,
  }
}

export async function usoDeHoy(ahora = new Date()): Promise<ResultadoUso> {
  const config = await obtenerConfig()
  const { data } = await supabaseAdmin()
    .from('uso_openai_diario')
    .select('*')
    .eq('fecha', fechaDeHoy(ahora))
    .maybeSingle()

  return {
    tokens_dia: Number(data?.tokens ?? 0),
    costo_dia_usd: Number(data?.costo_estimado_usd ?? 0),
    limite_usd: Number(config.limite_costo_diario_openai_usd),
    debe_alertar: false,
  }
}
