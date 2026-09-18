import { supabaseAdmin } from '@/lib/supabase/admin'
import type { NivelOperador } from '@/types/database'
import { fallo, type ResultadoAccion } from '../respuesta'

/**
 * Los permisos del canal de WhatsApp viven aquí, no en el prompt: el modelo
 * puede intentar cualquier cosa, el servidor decide. Un admin puede todo lo
 * de un operador; un operador no puede lo de admin.
 */

export type Autorizado = { id: string; nombre: string; telefono: string; nivel: NivelOperador }

const RANGO: Record<NivelOperador, number> = { operador: 1, admin: 2 }

export async function exigirNivel(
  telefono: string,
  nivel: NivelOperador,
): Promise<{ ok: true; autorizado: Autorizado } | { ok: false; rechazo: ResultadoAccion<never> }> {
  const { data } = await supabaseAdmin()
    .from('operador_whitelist')
    .select('id, nombre, telefono, nivel')
    .eq('telefono', telefono)
    .eq('activo', true)
    .maybeSingle()

  if (!data) {
    return {
      ok: false,
      rechazo: fallo('OPERADOR_NO_AUTORIZADO', 'Ese número no está autorizado como operador.', 403),
    }
  }

  const autorizado = data as Autorizado
  if (RANGO[autorizado.nivel] < RANGO[nivel]) {
    return {
      ok: false,
      rechazo: fallo(
        'OPERADOR_NO_AUTORIZADO',
        'Eso solo lo puede pedir un administrador. Pídeselo al dueño o revísalo en el CRM.',
        403,
      ),
    }
  }

  return { ok: true, autorizado }
}

/** Quién hizo qué por WhatsApp, para el historial del pedido. */
export function firma(autorizado: Autorizado): string {
  return `Por WhatsApp: ${autorizado.nombre} (${autorizado.telefono})`
}
