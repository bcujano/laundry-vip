/**
 * Crea (o revisa) las plantillas de WhatsApp de Lavandería VIP en Meta. Fuera de las 24 h de una
 * conversación, WhatsApp solo deja escribir primero con una plantilla aprobada.
 *
 *   pnpm tsx scripts/plantillas-meta.ts            → crea las que falten y muestra el estado de todas
 *   pnpm tsx scripts/plantillas-meta.ts --estado   → solo muestra el estado
 *
 * Usa WHATSAPP_CLOUD_API_TOKEN y WHATSAPP_WABA_ID de .env.local. No pisa las que ya existen (Meta no
 * deja editar una aprobada sin volver a revisarla). Una lavandería nueva cambia los textos aquí.
 * scripts/ no usa el alias @/.
 */
import { readFileSync } from 'node:fs'
import { cargarEntorno } from './db-conexion.ts'

cargarEntorno()
const TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN ?? ''
const WABA = process.env.WHATSAPP_WABA_ID ?? ''
const API = `https://graph.facebook.com/v21.0/${WABA}/message_templates`

type Plantilla = {
  name: string
  category: 'UTILITY' | 'MARKETING'
  texto: string
  /** Un ejemplo por cada {{n}} del texto (Meta los pide para revisarla). */
  ejemplos: string[]
  /** Ruta de un PDF que viaja en el encabezado del mensaje (el de ejemplo que Meta revisa). */
  documentoPdf?: string
}

/** Textos sin «ahorita», «un ratito» ni «la ropita» (tono de Sol); de usted siempre. */
const PLANTILLAS: Plantilla[] = [
  {
    name: 'reactivacion_30_dias',
    category: 'MARKETING',
    texto:
      'Hola, {{1}}. Hace un tiempo nos confió su ropa en VIP Laundry y nos gustaría volver a atenderle. Si lo necesita, escríbanos por este chat y coordinamos la recogida. Que tenga un buen día.',
    ejemplos: ['Ana'],
  },
  {
    name: 'reactivacion_90_dias',
    category: 'MARKETING',
    texto:
      'Hola, {{1}}. En VIP Laundry nos acordamos de usted y de su ropa. Cuando guste, escríbanos por este chat y le ayudamos con su próximo pedido. Con gusto le atendemos.',
    ejemplos: ['Ana'],
  },
  {
    name: 'ropa_no_retirada',
    category: 'UTILITY',
    texto:
      'Hola, {{1}}. Le recordamos que su ropa de VIP Laundry sigue esperando su retiro desde hace {{2}} días. Escríbanos por este chat para coordinar el retiro o la entrega. Gracias.',
    ejemplos: ['Ana', '7'],
  },
  {
    name: 'encuesta_satisfaccion',
    category: 'UTILITY',
    texto:
      'Hola, {{1}}. Gracias por confiar en VIP Laundry. ¿Cómo califica nuestro servicio del 1 al 5, donde 5 es excelente? Responda solo con el número. Su opinión nos ayuda a mejorar.',
    ejemplos: ['Ana'],
  },
  {
    name: 'resena_google',
    category: 'MARKETING',
    texto:
      'Hola, {{1}}. Nos alegra que su experiencia con VIP Laundry haya sido buena. Si desea, déjenos una reseña en Google: {{2}}. Muchas gracias por su confianza.',
    ejemplos: ['Ana', 'https://g.page/r/ejemplo/review'],
  },
  {
    name: 'prospecto_primer_contacto',
    category: 'MARKETING',
    texto:
      'Hola, somos VIP Laundry, lavandería en La Kennedy, Quito. Atendemos a negocios como {{1}} con el lavado de {{2}}. Si le interesa conocer nuestra lista de precios, responda a este mensaje. Si no desea recibir mensajes nuestros, responda NO.',
    ejemplos: ['Eventos Quito', 'manteles, mandiles y ropa de trabajo'],
  },
  {
    name: 'prospecto_presentacion',
    category: 'MARKETING',
    texto:
      '📌 VIP LAUNDRY: Cuidado Textil y Lavandería Premium\n\nNuestro servicio está diseñado para liberarle de la carga del lavado y planchado, optimizando su tiempo libre. Cuidamos sus prendas más delicadas (ternos, vestidos de fiesta), la ropa de cama pesada (edredones, alfombras) y la ropa de uso diario, garantizando un acabado impecable.\n\n🚚 Modalidad: recogida y entrega a domicilio ($2,50)\n⏱️ Tiempos: entrega en 24 a 72 horas según el servicio\n📄 Precios: le enviamos la lista de precios apenas nos escriba\n🎖️ Garantía: cuidado corporativo y VIP para cada prenda\n\nPara programar un retiro a domicilio o hacer consultas, escríbanos por este chat de WhatsApp: +593 98 566 2822.\n\nQuedamos a sus órdenes para coordinar sus pedidos. Saludos cordiales. Si no desea recibir mensajes nuestros, responda NO.',
    ejemplos: [],
  },
  {
    name: 'prospecto_catalogo',
    category: 'MARKETING',
    texto:
      '📌 VIP LAUNDRY: Cuidado Textil y Lavandería Premium\n\nNuestro servicio está diseñado para liberarle de la carga del lavado y planchado, optimizando su tiempo libre. Cuidamos sus prendas más delicadas (ternos, vestidos de fiesta), la ropa de cama pesada (edredones, alfombras) y la ropa de uso diario, garantizando un acabado impecable.\n\n🚚 Modalidad: recogida y entrega a domicilio ($2,50)\n⏱️ Tiempos: entrega en 24 a 72 horas según el servicio\n📄 Precios: le enviamos la lista de precios apenas nos escriba\n🎖️ Garantía: cuidado corporativo y VIP para cada prenda\n\nPara programar un retiro a domicilio o hacer consultas, escríbanos por este chat de WhatsApp: +593 98 566 2822.\n\nQuedamos a sus órdenes para coordinar sus pedidos. Saludos cordiales. Si no desea recibir mensajes nuestros, responda NO.',
    ejemplos: [],
    documentoPdf: 'public/catalogo.pdf',
  },
  {
    name: 'reporte_negocio',
    category: 'UTILITY',
    texto:
      'Reporte {{1}} de VIP Laundry para la administración. Resumen: {{2}} Puede ver el detalle completo en el CRM, en esta dirección: {{3}} Gracias por su atención.',
    ejemplos: [
      'semanal',
      'Pedidos cerrados: 12. Ventas verificadas: $340,00.',
      'https://laundry-vip.vercel.app',
    ],
  },
]

type Existente = { name: string; status: string; category: string }

async function listar(): Promise<Existente[]> {
  const r = await fetch(`${API}?fields=name,status,category&limit=100`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  })
  const cuerpo = (await r.json()) as { data?: Existente[]; error?: { message: string } }
  if (!r.ok) throw new Error(cuerpo.error?.message ?? `HTTP ${r.status}`)
  return cuerpo.data ?? []
}

/** Sube el PDF a Meta (subida reanudable) y devuelve el identificador que pide el encabezado. */
async function subirPdf(ruta: string): Promise<string> {
  const datos = readFileSync(ruta)
  const quien = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${TOKEN}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  })
  const appId = ((await quien.json()) as { data?: { app_id?: string } }).data?.app_id
  if (!appId) throw new Error('No se pudo saber el id de la app de Meta.')
  const sesion = await fetch(
    `https://graph.facebook.com/v21.0/${appId}/uploads?file_length=${datos.length}&file_type=application/pdf&file_name=catalogo.pdf`,
    { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` } },
  )
  const { id } = (await sesion.json()) as { id?: string }
  if (!id) throw new Error('Meta no abrió la subida del PDF.')
  const subida = await fetch(`https://graph.facebook.com/v21.0/${id}`, {
    method: 'POST',
    headers: { authorization: `OAuth ${TOKEN}`, file_offset: '0' },
    body: datos,
  })
  const { h } = (await subida.json()) as { h?: string }
  if (!h) throw new Error('Meta no devolvió el identificador del PDF.')
  return h
}

async function crear(p: Plantilla) {
  const encabezado = p.documentoPdf
    ? [
        {
          type: 'HEADER',
          format: 'DOCUMENT',
          example: { header_handle: [await subirPdf(p.documentoPdf)] },
        },
      ]
    : []
  const r = await fetch(API, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: p.name,
      language: 'es',
      category: p.category,
      allow_category_change: true,
      components: [
        ...encabezado,
        {
          type: 'BODY',
          text: p.texto,
          ...(p.ejemplos.length ? { example: { body_text: [p.ejemplos] } } : {}),
        },
      ],
    }),
  })
  const cuerpo = (await r.json()) as { id?: string; status?: string; error?: { message: string } }
  return r.ok ? `creada (${cuerpo.status ?? 'en revisión'})` : `ERROR: ${cuerpo.error?.message}`
}

if (!TOKEN || !WABA)
  throw new Error('Faltan WHATSAPP_CLOUD_API_TOKEN o WHATSAPP_WABA_ID en .env.local.')
const soloEstado = process.argv.includes('--estado')
const existentes = new Map((await listar()).map((e) => [e.name, e]))
for (const p of PLANTILLAS) {
  const ya = existentes.get(p.name)
  if (ya) {
    console.log(`${p.name}: ya existe → ${ya.status} (${ya.category})`)
  } else if (soloEstado) {
    console.log(`${p.name}: no existe`)
  } else {
    console.log(`${p.name}: ${await crear(p)}`)
  }
}
