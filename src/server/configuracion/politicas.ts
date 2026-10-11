import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Politica, QuienDecide } from '@/types/database'

export type ResultadoPolitica = { ok: true } | { ok: false; error: string }

export async function listarPoliticas(): Promise<Politica[]> {
  const { data, error } = await supabaseAdmin()
    .from('politicas')
    .select('*')
    .order('titulo', { ascending: true })
  if (error) throw new Error(`No se pudieron leer las políticas: ${error.message}`)
  return (data ?? []) as Politica[]
}

export async function obtenerPolitica(tema: string): Promise<Politica | null> {
  const { data } = await supabaseAdmin()
    .from('politicas')
    .select('*')
    .eq('tema', tema)
    .eq('activa', true)
    .maybeSingle()
  return (data as Politica | null) ?? null
}

export type CambiosPolitica = {
  regla: string
  quien_decide: QuienDecide
  plazo_respuesta: string
  frase_guia: string
  activa: boolean
}

export async function guardarPolitica(
  id: string,
  cambios: CambiosPolitica,
): Promise<ResultadoPolitica> {
  const { error } = await supabaseAdmin()
    .from('politicas')
    .update({ ...cambios, actualizado_en: new Date().toISOString() })
    .eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}
