/**
 * El primer mensaje a un prospecto, por plantilla de Meta. Es el único canal permitido para escribirle a
 * quien nunca nos ha escrito (fuera de las 24 h solo valen las plantillas aprobadas). La plantilla se
 * define y se manda a revisión en `scripts/plantillas-meta.ts`.
 *
 * Es el texto de presentación que escribió el dueño, sin variables, con el catálogo en PDF como documento
 * adjunto en el encabezado. No promete recogida en una zona concreta: la cobertura se verifica con la
 * dirección cuando el prospecto responde.
 */
export const PLANTILLA_PRIMER_CONTACTO = 'prospecto_catalogo'

/** El PDF que viaja en el encabezado: el mismo catálogo que el agente manda en el chat. */
export const DOCUMENTO_PRIMER_CONTACTO = 'https://laundry-vip.vercel.app/catalogo.pdf'

/** La plantilla no tiene variables. */
export const parametrosPrimerContacto = (): string[] => []
