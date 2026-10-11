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

async function crear(p: Plantilla) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: p.name,
      language: 'es',
      category: p.category,
      allow_category_change: true,
      components: [
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
