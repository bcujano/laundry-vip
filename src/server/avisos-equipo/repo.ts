import { chatwootConversacion } from '@/lib/chatwoot'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import { type HorarioLocal, minutosHabiles } from './horario-habil'
import { etiquetaDe, parametroPlantilla } from './tipos'

/** Una persona atiende el aviso en este plazo; si no, se repite una sola vez. */
export const MINUTOS_HABILES_REINTENTO = 30

/** Prefijo de `caso` reservado a las pruebas automáticas. */
export const PREFIJO_PRUEBA = 'prueba:'

const VENTANA_META_MS = 23 * 60 * 60 * 1000

export async function horarioDelLocal(): Promise<HorarioLocal> {
  const c = await obtenerConfig()
  return {
    dias: c.dias_operacion,
    apertura: c.hora_apertura.slice(0, 5),
    cierre: c.hora_cierre.slice(0, 5),
    cierreSabado: c.hora_cierre_sabado.slice(0, 5),
  }
}

export type DatosAvisoEquipo = {
  tipo: string
  caso: string
  chatwoot_conversation_id?: number
  telefono_cliente?: string
  resumen: string
}

/**
 * Crea el aviso de un caso. Si ya hay uno abierto del mismo tipo para ese caso no crea
 * otro (un aviso por caso, no por mensaje) y lo dice.
 */
export async function crearAvisoEquipo(datos: DatosAvisoEquipo): Promise<{ creado: boolean }> {
  const { error } = await supabaseAdmin()
    .from('avisos_equipo')
    .insert({
      tipo: datos.tipo,
      caso: datos.caso,
      chatwoot_conversation_id: datos.chatwoot_conversation_id ?? null,
      telefono_cliente: datos.telefono_cliente ?? null,
      resumen: datos.resumen,
    })
  if (!error) return { creado: true }
  // 23505 = ya hay un aviso abierto de ese tipo para ese caso: es el dedupe, no un fallo.
  if (error.code === '23505') return { creado: false }
  throw new Error(`No se pudo crear el aviso al equipo: ${error.message}`)
}

type FilaAviso = {
  id: string
  tipo: string
  caso: string
  chatwoot_conversation_id: number | null
  telefono_cliente: string | null
  resumen: string
  estado: 'pendiente' | 'enviado' | 'reintentado' | 'atendido'
  intentos: number
  enviado_en: string | null
}

export type AvisoParaEnviar = {
  id: string
  reintento: boolean
  etiqueta: string
  /** Texto libre, para quien escribió al agente en las últimas 24 h. */
  texto: string
  /** Parámetros de la plantilla de Meta, en orden: caso, cliente, resumen, enlace. */
  parametros: [string, string, string, string]
}

export type Destinatario = { nombre: string; telefono: string; dentro_de_ventana: boolean }

async function destinatarios(ahora: Date): Promise<Destinatario[]> {
  const { data } = await supabaseAdmin()
    .from('operador_whitelist')
    .select('nombre, telefono, ultimo_mensaje_en')
    .eq('activo', true)
    .eq('recibe_avisos', true)
  return (data ?? []).map((p) => ({
    nombre: p.nombre as string,
    telefono: String(p.telefono).replace(/\D/g, ''),
    dentro_de_ventana:
      p.ultimo_mensaje_en !== null &&
      ahora.getTime() - new Date(p.ultimo_mensaje_en as string).getTime() < VENTANA_META_MS,
  }))
}

/** Pura: ¿toca mandarlo ahora (primera vez) o repetirlo (30 min hábiles sin atender)? */
export function accionDeAviso(
  fila: Pick<FilaAviso, 'estado' | 'enviado_en'>,
  ahora: Date,
  horario: HorarioLocal,
): 'enviar' | 'reintentar' | 'esperar' {
  if (fila.estado === 'pendiente') return 'enviar'
  if (fila.estado === 'enviado' && fila.enviado_en) {
    const habiles = minutosHabiles(new Date(fila.enviado_en), ahora, horario)
    return habiles >= MINUTOS_HABILES_REINTENTO ? 'reintentar' : 'esperar'
  }
  return 'esperar'
}

function armar(fila: FilaAviso, reintento: boolean): AvisoParaEnviar {
  const etiqueta = etiquetaDe(fila.tipo)
  const cliente = fila.telefono_cliente ?? 'sin teléfono'
  const enlace =
    fila.chatwoot_conversation_id === null
      ? 'sin chat en Chatwoot'
      : chatwootConversacion(fila.chatwoot_conversation_id)
  const resumen = parametroPlantilla(fila.resumen)
  const cabecera = reintento ? '🔔 SIN ATENDER' : '🔔 Aviso'
  return {
    id: fila.id,
    reintento,
    etiqueta,
    texto: `${cabecera}: ${etiqueta}\nCliente: ${cliente}\n${resumen}\nChat: ${enlace}`,
    parametros: [
      parametroPlantilla(reintento ? `${etiqueta} (sin atender)` : etiqueta, 60),
      parametroPlantilla(cliente, 40),
      resumen,
      enlace,
    ],
  }
}

/** Lo que n8n debe mandar ahora y a quién. Solo lectura: n8n marca después de enviar. */
export async function avisosPorEnviar(
  ahora = new Date(),
): Promise<{ avisos: AvisoParaEnviar[]; destinatarios: Destinatario[] }> {
  const horario = await horarioDelLocal()
  const { data } = await supabaseAdmin()
    .from('avisos_equipo')
    .select('*')
    .in('estado', ['pendiente', 'enviado'])
    // Los casos que crean las pruebas automáticas (base única) jamás se mandan a nadie.
    .not('caso', 'like', `${PREFIJO_PRUEBA}%`)
    .order('creado_en', { ascending: true })
    .limit(20)
  const avisos: AvisoParaEnviar[] = []
  for (const fila of (data ?? []) as FilaAviso[]) {
    const accion = accionDeAviso(fila, ahora, horario)
    if (accion !== 'esperar') avisos.push(armar(fila, accion === 'reintentar'))
  }
  return { avisos, destinatarios: avisos.length > 0 ? await destinatarios(ahora) : [] }
}

export async function marcarAvisoEquipo(id: string, estado: 'enviado' | 'reintentado') {
  const db = supabaseAdmin()
  const { data } = await db.from('avisos_equipo').select('intentos').eq('id', id).maybeSingle()
  await db
    .from('avisos_equipo')
    .update({
      estado,
      intentos: Math.min(2, ((data as { intentos: number } | null)?.intentos ?? 0) + 1),
      ...(estado === 'enviado' ? { enviado_en: new Date().toISOString() } : {}),
    })
    .eq('id', id)
}

/** Una persona escribió en el chat: los avisos abiertos de esa conversación quedan atendidos. */
export async function atenderAvisosDeConversacion(conversacion: number): Promise<number> {
  const { data } = await supabaseAdmin()
    .from('avisos_equipo')
    .update({ estado: 'atendido', atendido_en: new Date().toISOString() })
    .eq('chatwoot_conversation_id', conversacion)
    .neq('estado', 'atendido')
    .select('id')
  return (data ?? []).length
}
