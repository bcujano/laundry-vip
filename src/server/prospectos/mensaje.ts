/**
 * El primer mensaje a un prospecto, por plantilla de Meta. Es el único canal permitido para escribirle a
 * quien nunca nos ha escrito (fuera de las 24 h solo valen las plantillas aprobadas). La plantilla se
 * define y se manda a revisión en `scripts/plantillas-meta.ts`; aquí solo se arman sus dos variables.
 *
 * El texto NO promete recogida ni plazos: de los prospectos, la mayoría no se pudo ubicar para saber si
 * caen en los 2,5 km, y el plazo depende del servicio. Ofrece la lista de precios; cuando responden, el
 * agente verifica la cobertura de verdad con su dirección.
 */
export const PLANTILLA_PRIMER_CONTACTO = 'prospecto_primer_contacto'

/** Qué se les ofrece lavar, según el negocio. Todo sale del catálogo: manteles, mandiles, cobijas, trajes. */
const FRASE_POR_SEGMENTO: Record<string, string> = {
  catering: 'manteles, mandiles y ropa de trabajo',
  'salones de eventos': 'manteles, mandiles y ropa de trabajo',
  'centros de convenciones': 'manteles, mandiles y ropa de trabajo',
  'centros de convenciones; salones de eventos': 'manteles, mandiles y ropa de trabajo',
  'hogares de ancianos': 'ropa de cama, cobijas y ropa de diario',
  'geriátricos; hogares de ancianos': 'ropa de cama, cobijas y ropa de diario',
  'tiendas de alquiler de ropa': 'trajes, vestidos y prendas delicadas en seco',
}
const FRASE_GENERAL = 'ropa, manteles y cobijas'

export const fraseDeSegmento = (segmento: string) =>
  FRASE_POR_SEGMENTO[segmento.trim().toLowerCase()] ?? FRASE_GENERAL

/**
 * Meta rechaza una variable con saltos de línea, tabuladores o muchos espacios seguidos, y un nombre
 * larguísimo se ve mal en el mensaje. Se limpia y se corta en una palabra completa.
 */
export function nombreParaMensaje(nombre: string): string {
  const limpio = nombre
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (limpio.length <= 60) return limpio
  const corte = limpio.slice(0, 60)
  return corte.slice(0, corte.lastIndexOf(' ') > 20 ? corte.lastIndexOf(' ') : 60).trim()
}

export function parametrosPrimerContacto(prospecto: {
  nombre: string
  segmento: string
}): string[] {
  return [nombreParaMensaje(prospecto.nombre), fraseDeSegmento(prospecto.segmento)]
}
