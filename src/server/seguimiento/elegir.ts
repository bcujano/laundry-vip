/**
 * Seguimiento: a quién se le escribe y cuál de los cuatro mensajes le toca.
 * Toda la decisión es pura y vive aquí para poder probarla sin base: el
 * repositorio solo junta los datos.
 */

/**
 * Los cuatro seguimientos, en minutos de silencio del cliente. Recorren la
 * ventana de 24 h de WhatsApp; el último sale a las 23 h 30 min y tiene que
 * salir antes de las 23 h 54 min, o Meta ya no deja mandar texto libre.
 * `hasta` es el margen normal con que n8n, que pregunta cada 5 minutos, lo manda a tiempo.
 */
export const PASOS = [
  { paso: 1, desde: 30, hasta: 45 },
  { paso: 2, desde: 60, hasta: 75 },
  { paso: 3, desde: 360, hasta: 375 },
  { paso: 4, desde: 1410, hasta: 1434 },
] as const

/** El silencio más corto y el más largo que puede tocar un seguimiento. */
export const SILENCIO_MIN_MINUTOS = 30
export const SILENCIO_MAX_MINUTOS = 1434

export type Paso = (typeof PASOS)[number]['paso']

/**
 * Qué paso toca con ese silencio: el último cuyo momento ya llegó, mientras la
 * ventana de 24 h siga abierta. Así un paso que se quedó sin salir (de noche, un
 * domingo, n8n caído) sale en cuanto se puede, y nunca se mandan dos de golpe:
 * solo el más reciente.
 */
export function pasoDebido(minutosDeSilencio: number): Paso | null {
  if (minutosDeSilencio >= SILENCIO_MAX_MINUTOS) return null
  const vencidos = PASOS.filter((x) => minutosDeSilencio >= x.desde)
  return vencidos.length > 0 ? (vencidos[vencidos.length - 1] as { paso: Paso }).paso : null
}

/** Clave de un seguimiento ya hecho: ese paso, de esa conversación, en ese silencio. */
export const claveHecho = (telefono: string, paso: number, interaccion: string | number | Date) =>
  `${telefono}|${paso}|${new Date(interaccion).getTime()}`

export type FilaConversacion = {
  telefono: string
  chatwoot_conversation_id: number | null
  ultima_interaccion: string
  contexto: Record<string, unknown>
}

export type Candidato = {
  paso: Paso
  /** Seguimientos que ya se le mandaron en este mismo silencio, para no repetirse. */
  anteriores: string[]
  /** Barrido del dueño: n8n no aplica el filtro «ya le contestó una persona» a este chat. */
  sin_filtro_persona: boolean
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
  /** Teléfonos con pedido reciente. */
  excluidos: Set<string>
  /** Seguimientos ya hechos (`claveHecho`). */
  hechos: Set<string>
  /** Silencios (`telefono|interaccion`) donde el dueño ordenó un barrido. */
  barridos: Set<string>
  /** Textos ya enviados en un mismo silencio: clave `telefono|interaccion`. */
  textosPrevios: Map<string, string[]>
  /** Nombre que dijo el cliente o puso el CRM; el del perfil de WhatsApp no cuenta. */
  nombres: Map<string, string>
}

const texto = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '')

export function elegirCandidatos(filas: FilaConversacion[], ctx: ContextoSeleccion): Candidato[] {
  const minutos = (desde: string) => (ctx.ahora.getTime() - new Date(desde).getTime()) / 60_000

  return filas.flatMap((fila) => {
    const paso = pasoDebido(minutos(fila.ultima_interaccion))
    if (paso === null) return []
    if (ctx.hechos.has(claveHecho(fila.telefono, paso, fila.ultima_interaccion))) return []
    if (fila.chatwoot_conversation_id === null) return []
    if (ctx.equipo.has(fila.telefono) || ctx.excluidos.has(fila.telefono)) return []

    const c = fila.contexto
    if (c.escalado === true) return []
    if (c.temperatura !== 'tibio' && c.temperatura !== 'caliente') return []
    // Ya pidió: no es un lead dormido.
    const accion = texto(c.proxima_accion)
    if (accion === 'pedido_creado') return []
    // Sin lo último que se le dijo no hay de qué colgar el mensaje.
    const respuesta = texto(c.ultima_respuesta_agente)
    if (respuesta === '') return []

    const silencio = `${fila.telefono}|${new Date(fila.ultima_interaccion).getTime()}`
    return [
      {
        paso,
        anteriores: ctx.textosPrevios.get(silencio) ?? [],
        sin_filtro_persona: ctx.barridos.has(silencio),
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
  return minutos >= aMinutos(config.hora_apertura) && minutos < aMinutos(config.hora_cierre) - 30
}
