import { supabaseAdmin } from '@/lib/supabase/admin'

/** Margen bajo las 24 h de Meta: el envío tarda y los relojes no son exactos. */
const VENTANA_META_MS = 23 * 60 * 60 * 1000

export type AdminParaAviso = {
  nombre: string
  /** Solo dígitos, como lo pide la API de WhatsApp. */
  telefono: string
  /** Escribió al agente en las últimas 24 h: ahora cabe un texto libre. */
  dentro_de_ventana: boolean
}

/**
 * Las administradoras activas de la lista blanca (María Sol) para avisos como «un
 * lead no ha respondido». Texto libre solo si ella le escribió al agente en las
 * últimas 24 h; si no, el aviso queda en la nota interna del chat.
 */
export async function adminsParaAviso(ahora = new Date()): Promise<AdminParaAviso[]> {
  const { data } = await supabaseAdmin()
    .from('operador_whitelist')
    .select('nombre, telefono, ultimo_mensaje_en')
    .eq('activo', true)
    .eq('nivel', 'admin')
  return (data ?? []).map((a) => ({
    nombre: a.nombre as string,
    telefono: String(a.telefono).replace(/\D/g, ''),
    dentro_de_ventana:
      a.ultimo_mensaje_en !== null &&
      ahora.getTime() - new Date(a.ultimo_mensaje_en as string).getTime() < VENTANA_META_MS,
  }))
}
