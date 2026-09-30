import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import {
  type Candidato,
  dentroDelHorario,
  ENFRIAMIENTO_HORAS,
  elegirCandidatos,
  type FilaConversacion,
  SILENCIO_MAX_HORAS,
  SILENCIO_MIN_HORAS,
} from './elegir'

export type ModoSeguimiento = 'apagado' | 'borrador' | 'activo'

const LIMITE_POR_CORRIDA = 10

const haceHoras = (ahora: Date, horas: number) =>
  new Date(ahora.getTime() - horas * 3_600_000).toISOString()

/** A quién se le escribe ahora, y en qué modo. Fuera de horario o apagado: nadie. */
export async function buscarCandidatos(
  ahora = new Date(),
): Promise<{ modo: ModoSeguimiento; candidatos: Candidato[] }> {
  const config = await obtenerConfig()
  const modo = config.seguimiento_modo
  if (modo === 'apagado' || !dentroDelHorario(ahora, config)) return { modo, candidatos: [] }

  const db = supabaseAdmin()
  const { data: filas, error } = await db
    .from('conversaciones')
    .select('telefono, chatwoot_conversation_id, ultima_interaccion, contexto')
    .gte('ultima_interaccion', haceHoras(ahora, SILENCIO_MAX_HORAS))
    .lte('ultima_interaccion', haceHoras(ahora, SILENCIO_MIN_HORAS))
    .order('ultima_interaccion', { ascending: true })
    .limit(100)
  if (error) throw new Error(`No se pudieron leer las conversaciones: ${error.message}`)
  const conversaciones = (filas ?? []) as FilaConversacion[]
  if (conversaciones.length === 0) return { modo, candidatos: [] }

  const telefonos = conversaciones.map((f) => f.telefono)
  const [equipo, clientes, recientes] = await Promise.all([
    db.from('operador_whitelist').select('telefono').in('telefono', telefonos),
    db
      .from('clientes')
      .select('id, telefono, nombre_contacto, nombre_contacto_origen')
      .in('telefono', telefonos),
    db
      .from('seguimientos')
      .select('telefono')
      .in('telefono', telefonos)
      .gte('created_at', haceHoras(ahora, ENFRIAMIENTO_HORAS)),
  ])

  const clientesFila = (clientes.data ?? []) as {
    id: string
    telefono: string
    nombre_contacto: string | null
    nombre_contacto_origen: string
  }[]
  const { data: pedidos } = await db
    .from('pedidos')
    .select('cliente_id')
    .in(
      'cliente_id',
      clientesFila.map((c) => c.id),
    )
    .gte('created_at', haceHoras(ahora, SILENCIO_MAX_HORAS + 24))
  const conPedido = new Set((pedidos ?? []).map((p) => p.cliente_id as string))

  const excluidos = new Set<string>((recientes.data ?? []).map((r) => r.telefono as string))
  const nombres = new Map<string, string>()
  for (const c of clientesFila) {
    if (conPedido.has(c.id)) excluidos.add(c.telefono)
    // El nombre del perfil de WhatsApp no cuenta como nombre dicho por el cliente.
    if (c.nombre_contacto && c.nombre_contacto_origen !== 'whatsapp') {
      nombres.set(c.telefono, c.nombre_contacto)
    }
  }

  const candidatos = elegirCandidatos(conversaciones, {
    ahora,
    equipo: new Set((equipo.data ?? []).map((e) => e.telefono as string)),
    excluidos,
    nombres,
  }).slice(0, LIMITE_POR_CORRIDA)
  return { modo, candidatos }
}

export async function registrarSeguimiento(datos: {
  telefono: string
  chatwoot_conversation_id?: number
  modo: 'borrador' | 'activo'
  mensaje: string
  interaccion_base: string
}): Promise<void> {
  const { error } = await supabaseAdmin().from('seguimientos').insert(datos)
  if (error) throw new Error(`No se pudo registrar el seguimiento: ${error.message}`)
}
