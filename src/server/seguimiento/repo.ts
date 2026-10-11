import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import {
  type Candidato,
  claveHecho,
  dentroDelHorario,
  elegirCandidatos,
  type FilaConversacion,
  SILENCIO_MAX_MINUTOS,
  SILENCIO_MIN_MINUTOS,
} from './elegir'

export type ModoSeguimiento = 'apagado' | 'borrador' | 'activo'

const LIMITE_POR_CORRIDA = 10

const haceMinutos = (ahora: Date, minutos: number) =>
  new Date(ahora.getTime() - minutos * 60_000).toISOString()

/** A quién se le escribe ahora, qué paso le toca y en qué modo. Fuera de horario o apagado: nadie. */
export async function buscarCandidatos(
  ahora = new Date(),
): Promise<{ modo: ModoSeguimiento; candidatos: Candidato[] }> {
  const config = await obtenerConfig()
  const modo = config.seguimiento_modo
  if (modo === 'apagado' || !dentroDelHorario(ahora, config)) return { modo, candidatos: [] }

  const db = supabaseAdmin()
  const { data: filas, error } = await db
    .from('conversaciones')
    .select('telefono, chatwoot_conversation_id, ultima_interaccion, contexto, no_seguir')
    .gte('ultima_interaccion', haceMinutos(ahora, SILENCIO_MAX_MINUTOS))
    .lte('ultima_interaccion', haceMinutos(ahora, SILENCIO_MIN_MINUTOS))
    .order('ultima_interaccion', { ascending: true })
    .limit(100)
  if (error) throw new Error(`No se pudieron leer las conversaciones: ${error.message}`)
  const conversaciones = (filas ?? []) as FilaConversacion[]
  if (conversaciones.length === 0) return { modo, candidatos: [] }

  const telefonos = conversaciones.map((f) => f.telefono)
  const [equipo, clientes, previos] = await Promise.all([
    db.from('operador_whitelist').select('telefono').in('telefono', telefonos),
    db
      .from('clientes')
      .select('id, telefono, nombre_contacto, nombre_contacto_origen')
      .in('telefono', telefonos),
    db
      .from('seguimientos')
      .select('telefono, paso, mensaje, interaccion_base, barrido')
      .in('telefono', telefonos)
      .gte('interaccion_base', haceMinutos(ahora, SILENCIO_MAX_MINUTOS + 60))
      .order('paso', { ascending: true }),
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
    .gte('created_at', haceMinutos(ahora, SILENCIO_MAX_MINUTOS + 24 * 60))
  const conPedido = new Set((pedidos ?? []).map((p) => p.cliente_id as string))

  const excluidos = new Set<string>()
  // Quien pidió que no le escriban más no recibe ningún seguimiento.
  for (const c of conversaciones) if (c.no_seguir) excluidos.add(c.telefono)
  const nombres = new Map<string, string>()
  for (const c of clientesFila) {
    if (conPedido.has(c.id)) excluidos.add(c.telefono)
    // El nombre del perfil de WhatsApp no cuenta como nombre dicho por el cliente.
    if (c.nombre_contacto && c.nombre_contacto_origen !== 'whatsapp') {
      nombres.set(c.telefono, c.nombre_contacto)
    }
  }

  const hechos = new Set<string>()
  const textosPrevios = new Map<string, string[]>()
  const barridos = new Set<string>()
  for (const p of (previos.data ?? []) as {
    telefono: string
    paso: number
    mensaje: string
    interaccion_base: string
    barrido: boolean
  }[]) {
    hechos.add(claveHecho(p.telefono, p.paso, p.interaccion_base))
    const clave = `${p.telefono}|${new Date(p.interaccion_base).getTime()}`
    textosPrevios.set(clave, [...(textosPrevios.get(clave) ?? []), p.mensaje])
    if (p.barrido) barridos.add(clave)
  }

  const candidatos = elegirCandidatos(conversaciones, {
    ahora,
    equipo: new Set((equipo.data ?? []).map((e) => e.telefono as string)),
    excluidos,
    hechos,
    barridos,
    textosPrevios,
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
  paso: number
}): Promise<void> {
  const { error } = await supabaseAdmin().from('seguimientos').insert(datos)
  if (error) throw new Error(`No se pudo registrar el seguimiento: ${error.message}`)
}
