import { supabaseAdmin } from '@/lib/supabase/admin'
import type { EstadoProspecto, Prospecto } from '@/types/database'
import { derivarEtapa, type Etapa } from './etapa'

export type FilaProspecto = Prospecto & { etapa: Etapa }

export type ResultadoEscritura = { ok: true } | { ok: false; error: string }

type PedidosDe = { telefono: string; pedidos: { count: number }[] }

/** Todos los prospectos con su etapa deducida. Son cientos, no miles: se leen completos. */
export async function listarProspectos(): Promise<FilaProspecto[]> {
  const db = supabaseAdmin()
  const [prospectos, conversaciones, clientes] = await Promise.all([
    db.from('prospectos').select('*').order('created_at', { ascending: true }),
    db.from('conversaciones').select('telefono, no_seguir'),
    db.from('clientes').select('telefono, pedidos(count)'),
  ])
  if (prospectos.error)
    throw new Error(`No se pudieron leer los prospectos: ${prospectos.error.message}`)

  const escribieron = new Map<string, boolean>(
    (conversaciones.data ?? []).map((c) => [c.telefono as string, c.no_seguir === true]),
  )
  const conPedidos = new Set(
    ((clientes.data ?? []) as unknown as PedidosDe[])
      .filter((c) => (c.pedidos?.[0]?.count ?? 0) > 0)
      .map((c) => c.telefono),
  )

  return (prospectos.data as Prospecto[]).map((p) => ({
    ...p,
    etapa: derivarEtapa(p.estado, {
      escribio: p.telefono !== null && escribieron.has(p.telefono),
      noSeguir: p.telefono !== null && escribieron.get(p.telefono) === true,
      esCliente: p.telefono !== null && conPedidos.has(p.telefono),
    }),
  }))
}

/** Lo que hace el equipo a mano: llamar, descartar, pedir que no se le escriba, devolverlo a «nuevo». */
export async function cambiarEstado(
  id: string,
  estado: EstadoProspecto,
  canal: 'llamada' | 'manual' = 'manual',
): Promise<ResultadoEscritura> {
  const cambios: Record<string, unknown> = { estado }
  if (estado === 'contactado') {
    cambios.primer_contacto_en = new Date().toISOString()
    cambios.canal_primer_contacto = canal
  }
  const { error } = await supabaseAdmin().from('prospectos').update(cambios).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function guardarNotas(id: string, notas: string): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin()
    .from('prospectos')
    .update({ notas: notas.trim() })
    .eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Lo llama n8n cuando Meta aceptó el primer contacto: el prospecto deja de estar «nuevo». */
export async function marcarContactadoPorPlantilla(id: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('prospectos')
    .update({
      estado: 'contactado',
      primer_contacto_en: new Date().toISOString(),
      canal_primer_contacto: 'plantilla_whatsapp',
    })
    .eq('id', id)
    .eq('estado', 'nuevo')
  if (error) throw new Error(`No se pudo marcar el prospecto como contactado: ${error.message}`)
}
