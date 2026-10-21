import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Bitácora de contactos con prospectos. Guarda lo que hace el equipo y el envío en frío; lo que pasa
 * después de que el prospecto responde (la conversación con el agente y sus seguimientos) ya está en
 * `conversaciones` y `seguimientos`, y aquí solo se junta al leer.
 */
export type TipoContacto =
  | 'primer_contacto'
  | 'seguimiento'
  | 'respuesta'
  | 'baja'
  | 'estado'
  | 'nota'
export type CanalContacto =
  | 'plantilla_whatsapp'
  | 'whatsapp'
  | 'llamada'
  | 'instagram'
  | 'email'
  | 'otro'

export const ETIQUETA_TIPO: Record<TipoContacto | 'agente', string> = {
  primer_contacto: 'Primer contacto',
  seguimiento: 'Seguimiento',
  respuesta: 'Respondió',
  baja: 'Pidió no ser contactado',
  estado: 'Cambio de estado',
  nota: 'Nota',
  agente: 'Agente de WhatsApp',
}

export const ETIQUETA_CANAL: Record<CanalContacto, string> = {
  plantilla_whatsapp: 'Plantilla de WhatsApp',
  whatsapp: 'WhatsApp',
  llamada: 'Llamada',
  instagram: 'Instagram',
  email: 'Correo',
  otro: 'Otro',
}

export type Contacto = {
  id: string
  prospecto_id: string
  ocurrio_en: string
  tipo: TipoContacto | 'agente'
  canal: CanalContacto | null
  resultado: string
  detalle: string
  autor: string
  automatico: boolean
}

export type NuevoContacto = {
  prospectoId: string
  tipo: TipoContacto
  canal?: CanalContacto | null
  resultado?: string
  detalle?: string
  autor?: string
  automatico?: boolean
}

/** Anota un hecho. Una bitácora que falla no debe tumbar la acción que la originó: devuelve el error. */
export async function registrarContacto(
  c: NuevoContacto,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin()
    .from('prospecto_contactos')
    .insert({
      prospecto_id: c.prospectoId,
      tipo: c.tipo,
      canal: c.canal ?? null,
      resultado: c.resultado ?? '',
      detalle: c.detalle ?? '',
      autor: c.autor ?? 'Automático',
      automatico: c.automatico ?? c.autor === undefined,
    })
  return error ? { ok: false, error: error.message } : { ok: true }
}

type FilaAgente = { telefono: string; fecha: string; tipo: 'respuesta' | 'agente'; texto: string }

/**
 * Junta lo anotado a mano o por el envío con lo que el agente ya registró de esos teléfonos: cuándo
 * escribió el prospecto por primera vez y cada seguimiento automático. De lo más nuevo a lo más viejo.
 */
export function unirHistorial(
  anotados: Contacto[],
  delAgente: FilaAgente[],
  prospectoPorTelefono: Map<string, string>,
): Contacto[] {
  const derivados: Contacto[] = delAgente.flatMap((f) => {
    const prospecto = prospectoPorTelefono.get(f.telefono)
    if (!prospecto) return []
    return [
      {
        id: `agente-${f.tipo}-${f.telefono}-${f.fecha}`,
        prospecto_id: prospecto,
        ocurrio_en: f.fecha,
        tipo: f.tipo,
        canal: 'whatsapp' as const,
        resultado: f.tipo === 'respuesta' ? 'Le escribió al agente' : 'Seguimiento automático',
        detalle: f.texto,
        autor: 'Agente de WhatsApp',
        automatico: true,
      },
    ]
  })
  return [...anotados, ...derivados].sort((a, b) => b.ocurrio_en.localeCompare(a.ocurrio_en))
}

/** El historial completo, o el de un solo prospecto, ya unido con lo del agente. */
export async function historial(prospectoId?: string, limite = 500): Promise<Contacto[]> {
  const db = supabaseAdmin()
  const consulta = db
    .from('prospecto_contactos')
    .select('*')
    .order('ocurrio_en', { ascending: false })
    .limit(limite)
  const [anotados, prospectos] = await Promise.all([
    prospectoId ? consulta.eq('prospecto_id', prospectoId) : consulta,
    prospectoId
      ? db.from('prospectos').select('id, telefono').eq('id', prospectoId)
      : db.from('prospectos').select('id, telefono').not('telefono', 'is', null),
  ])
  if (anotados.error) throw new Error(`No se pudo leer la bitácora: ${anotados.error.message}`)

  const porTelefono = new Map(
    (prospectos.data ?? [])
      .filter((p) => p.telefono !== null)
      .map((p) => [p.telefono as string, p.id as string]),
  )
  const telefonos = [...porTelefono.keys()]
  if (telefonos.length === 0) return anotados.data as Contacto[]

  const [conversaciones, seguimientos] = await Promise.all([
    db.from('conversaciones').select('telefono, created_at').in('telefono', telefonos),
    db.from('seguimientos').select('telefono, created_at, mensaje, modo').in('telefono', telefonos),
  ])
  const delAgente: FilaAgente[] = [
    ...(conversaciones.data ?? []).map((c) => ({
      telefono: c.telefono as string,
      fecha: c.created_at as string,
      tipo: 'respuesta' as const,
      texto: '',
    })),
    ...(seguimientos.data ?? []).map((s) => ({
      telefono: s.telefono as string,
      fecha: s.created_at as string,
      tipo: 'agente' as const,
      texto: `${s.modo === 'activo' ? 'Enviado' : 'Borrador interno'}: ${s.mensaje as string}`,
    })),
  ]
  return unirHistorial(anotados.data as Contacto[], delAgente, porTelefono)
}

/** Nombre y segmento de cada prospecto, para rotular el historial (la bitácora solo guarda el id). */
export async function nombresDeProspectos(): Promise<
  Map<string, { nombre: string; segmento: string }>
> {
  const { data, error } = await supabaseAdmin().from('prospectos').select('id, nombre, segmento')
  if (error) throw new Error(`No se pudieron leer los prospectos: ${error.message}`)
  return new Map(
    (data ?? []).map((p) => [
      p.id as string,
      { nombre: p.nombre as string, segmento: p.segmento as string },
    ]),
  )
}
