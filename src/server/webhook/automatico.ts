/**
 * ¿Este mensaje entrante lo escribió un bot o un contestador automático de otro negocio? A los prospectos
 * les llegan mucho (menús de WhatsApp Business, «gracias por comunicarte…»). No nos interesa conversar con
 * ellos ni insistirles; si después escribe una persona, ese mensaje ya no será automático y se atiende normal.
 *
 * Es heurístico y conservador: una señal fuerte basta (menú numerado, «mensaje automático», «digite la
 * opción», fuera de horario); las frases de cortesía comunes solo cuentan si vienen varias juntas, porque una
 * persona también puede escribir «gracias por escribirnos».
 */
const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

const FUERTES: RegExp[] = [
  /mensaje automatico|respuesta automatica|asistente virtual|chatbot/,
  /(digite|marque|presione|oprima|teclee|escriba el numero)\b.{0,25}(opcion|numero|\d)/,
  /elij[ae]\b.{0,20}(opcion|requerimiento|servicio)/,
  /(^|\n)\s*[1-9]\s*[.)-]+\s*\S[\s\S]*\n\s*[2-9]\s*[.)-]+\s*\S/, // menú: «1.- Alquiler  2.- Decoración»
  /fuera de(l)? horario|horario de atencion|en este momento no (estamos|podemos|me encuentro|nos encontramos)/,
  /(te|le|les) responderemos (a la brevedad|en breve|pronto|lo antes posible)|nos pondremos en contacto/,
]

const DEBILES: RegExp[] = [
  /gracias por (comunicarte|comunicarse|contactarnos|contactar|escribirnos|escribir|tu mensaje|su mensaje)/,
  /bienvenid[oa]s? a /,
  /como (podemos|puedo) (ayudarle|ayudarte|servirle)/,
  /especifica(nos)? (que|lo que) (necesitas|necesita)/,
  /(envianos|envienos|dejanos|dejenos) (tu|su) (e-?mail|correo|nombre|numero)/,
  /en la brevedad posible|a la brevedad posible/,
  /tu evento en las mejores manos/,
  /catalogos?:/,
  /linktr\.ee|bit\.ly/,
]

export function esRespuestaAutomatica(texto: string): boolean {
  const t = normalizar(texto)
  if (t.trim().length < 12) return false
  if (FUERTES.some((r) => r.test(t))) return true
  return DEBILES.filter((r) => r.test(t)).length >= 2
}
