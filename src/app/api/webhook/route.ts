import { timingSafeEqual } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { despachar } from '@/server/webhook/handlers'
import type { Sobre } from '@/server/webhook/respuesta'
import { sobreEntrante } from '@/server/webhook/schemas'

export const dynamic = 'force-dynamic'

/**
 * El único endpoint del agente. El CRM no tiene API REST: sus pantallas usan
 * Server Actions. Aquí solo entra n8n, y solo con el secreto correcto.
 */

/** Comparación en tiempo constante: un secreto no se compara con ===. */
function secretoValido(recibido: string | null): boolean {
  if (!recibido) return false

  const esperado = Buffer.from(env.N8N_WEBHOOK_SECRET, 'utf8')
  const dado = Buffer.from(recibido, 'utf8')

  if (dado.length !== esperado.length) {
    // Se compara igual contra sí mismo para no filtrar la longitud por tiempo.
    timingSafeEqual(esperado, esperado)
    return false
  }
  return timingSafeEqual(esperado, dado)
}

function responder<T>(sobre: Sobre<T>, estado: number): NextResponse {
  return NextResponse.json(sobre, { status: estado })
}

function error(code: string, message: string, estado: number): NextResponse {
  return responder({ ok: false, error: { code, message } }, estado)
}

/** Deja rastro de lo que se rompió, para poder mirarlo después en el CRM. */
async function registrarError(tipo: string, mensaje: string, payload: unknown): Promise<void> {
  try {
    await supabaseAdmin()
      .from('errores_agente')
      .insert({
        tipo_error: tipo,
        mensaje_error: mensaje,
        payload_bruto: payload as Record<string, unknown> | null,
      })
  } catch {
    // Si ni siquiera se puede registrar el error, no se tumba la respuesta.
  }
}

export async function POST(peticion: NextRequest): Promise<NextResponse> {
  // El secreto se comprueba ANTES de leer el cuerpo: sin él no se lee ni la
  // acción ni los parámetros, mucho menos se ejecuta algo.
  if (!secretoValido(peticion.headers.get('x-webhook-secret'))) {
    return error('NO_AUTORIZADO', 'Secreto de webhook inválido o ausente.', 401)
  }

  let cuerpo: unknown
  try {
    cuerpo = await peticion.json()
  } catch {
    return error('CUERPO_INVALIDO', 'El cuerpo de la petición no es JSON válido.', 400)
  }

  const sobre = sobreEntrante.safeParse(cuerpo)
  if (!sobre.success) {
    const detalle = sobre.error.issues[0]?.message ?? 'Falta el campo "accion".'
    return error('ACCION_DESCONOCIDA', detalle, 400)
  }

  try {
    const resultado = await despachar(sobre.data.accion, sobre.data.parametros)

    return resultado.ok
      ? responder({ ok: true, data: resultado.data }, 200)
      : error(resultado.codigo, resultado.mensaje, resultado.estadoHttp ?? 400)
  } catch (fallo) {
    const mensaje = fallo instanceof Error ? fallo.message : 'Error desconocido.'
    await registrarError(`accion:${sobre.data.accion}`, mensaje, cuerpo)
    return error('ERROR_INTERNO', 'No se pudo completar la acción.', 500)
  }
}
