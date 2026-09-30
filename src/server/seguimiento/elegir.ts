/**
 * Seguimiento: a quién se le escribe. Toda la decisión es pura y vive aquí
 * para poder probarla sin base: el repositorio solo junta los datos.
 */

/** Silencio mínimo antes de insistir, y tope para no salirse de las 24 h de Meta. */
export const SILENCIO_MIN_HORAS = 3
export const SILENCIO_MAX_HORAS = 21
/** Un cliente recibe a lo sumo un seguimiento cada 48 h. */
export const ENFRIAMIENTO_HORAS = 48

export type FilaConversacion = {
  telefono: string
  chatwoot_conversation_id: number | null
  ultima_interaccion: string
  contexto: Record<string, unknown>
}

export type Candidato = {
  telefono: string
  chatwoot_conversation_id: number
  interaccion_base: string
  nombre: string | null
  necesidad: string
  proxima_accion: string
  ultimo_mensaje_cliente: string
  ultima_respuesta_agente: string
}

export type ContextoSeleccion = {
  ahora: Date
  /** Teléfonos del equipo (lista blanca): nunca son leads. */
  equipo: Set<string>
  /** Teléfonos con pedido reciente o con seguimiento reciente. */
  excluidos: Set<string>
  /** Nombre que dijo el cliente o puso el CRM; el del perfil de WhatsApp no cuenta. */
  nombres: Map<string, string>
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '')

export function elegirCandidatos(filas: FilaConversacion[], ctx: ContextoSeleccion): Candidato[] {
  const horas = (desde: string) => (ctx.ahora.getTime() - new Date(desde).getTime()) / 3_600_000

  return filas.flatMap((fila) => {
    const silencio = horas(fila.ultima_interaccion)
    if (silencio < SILENCIO_MIN_HORAS || silencio > SILENCIO_MAX_HORAS) return []
    if (fila.chatwoot_conversation_id === null) return []
    if (ctx.equipo.has(fila.telefono) || ctx.excluidos.has(fila.telefono)) return []

    const c = fila.contexto
    if (c.escalado === true) return []
    if (c.temperatura !== 'tibio' && c.temperatura !== 'caliente') return []
    // Ya pidió, o quedó esperando algo de nosotros: no es un lead dormido.
    const accion = texto(c.proxima_accion)
    if (accion === 'pedido_creado' || accion === 'seguimiento') return []
    // Sin lo último que se le dijo no hay de qué colgar el mensaje.
    const respuesta = texto(c.ultima_respuesta_agente)
    if (respuesta === '') return []

    return [
      {
        telefono: fila.telefono,
        chatwoot_conversation_id: fila.chatwoot_conversation_id,
        interaccion_base: fila.ultima_interaccion,
        nombre: ctx.nombres.get(fila.telefono) ?? null,
        necesidad: texto(c.necesidad),
        proxima_accion: accion,
        ultimo_mensaje_cliente: texto(c.ultimo_mensaje_cliente),
        ultima_respuesta_agente: respuesta,
      },
    ]
  })
}

/** ¿Es hora de escribir? Solo dentro del horario del local, en hora de Quito (UTC-5). */
export function dentroDelHorario(
  ahora: Date,
  config: { dias_operacion: number[]; hora_apertura: string; hora_cierre: string },
): boolean {
  const quito = new Date(ahora.getTime() - 5 * 3_600_000)
  const dia = quito.getUTCDay() === 0 ? 7 : quito.getUTCDay()
  if (!config.dias_operacion.includes(dia)) return false
  const minutos = quito.getUTCHours() * 60 + quito.getUTCMinutes()
  const aMinutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
  return minutos >= aMinutos(config.hora_apertura) && minutos < aMinutos(config.hora_cierre) - 60
}
