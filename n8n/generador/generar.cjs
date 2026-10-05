// Genera el workflow de Lavandería VIP a partir del de 321 (sin tocar el original).
const fs = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')
// La base es el JSON del agente 321 que entregó el dueño. NO se versiona: trae
// un secreto literal de 321. Pásalo como argumento o déjalo en Descargas.
const BASE =
  process.argv[2] ||
  path.join(require('node:os').homedir(), 'Downloads', 'iAgente 321 INMO V2.json')
const REPO = path.resolve(__dirname, '..', '..')
const w = JSON.parse(fs.readFileSync(BASE, 'utf8'))

const CRED = {
  chatwoot: { httpHeaderAuth: { id: '3W2BykSid0f9dMTV', name: 'Chatwoot Laundry VIP API' } },
  meta: { httpHeaderAuth: { id: 'baJJfX3zWMindSEN', name: 'Meta WhatsApp Laundry VIP' } },
  postgres: { postgres: { id: 'uS6oHAzjK8OQg6K3', name: 'Postgres Laundry VIP' } },
  crm: { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } },
  openai: { openAiApi: { id: 'GvNmUCZRx5ZvZerQ', name: 'OpenAi account' } },
}
const PHONE_321 = '937260122807094'
const PHONE_LVIP = '1220603671147410'

const KEEP = [
  'Chatwoot Webhook',
  'Filtro Chatwoot',
  'Filtro Humano',
  'WhatsApp Inicio',
  'Buscar Referral',
  'Agregar Referral',
  'Debounce',
  'Obtener Ultimos Mensajes',
  'Es Ultimo Mensaje?',
  'Combinar Textos',
  'Tipo de Mensaje',
  'Obtener URL Audio',
  'Descargar Audio',
  'Transcribir Audio',
  'Obtener URL Imagen',
  'Descargar Imagen',
  'Explicar Imagen',
  'OpenAI Vision',
  'Espera Texto',
  'Preparar Mensaje Final',
  'Typing Indicator',
  'Agente Arqui 321',
  'OpenAI Arqui',
  'Memory Arqui',
  'Calculator',
  'Extraer Imagen - OLD',
  'Necesita Humano?',
  'Etiqueta Humano',
  'Nota Escalamiento',
  'Enviar Respuesta Chatwoot',
]
const RENOMBRES = {
  'Agente Arqui 321': 'Agente Laundry VIP',
  'OpenAI Arqui': 'OpenAI Laundry',
  'Memory Arqui': 'Memory Laundry',
  'Extraer Imagen - OLD': 'Extraer JSON',
}

let nodes = w.nodes.filter((n) => KEEP.includes(n.name))
const faltan = KEEP.filter((k) => !nodes.some((n) => n.name === k))
if (faltan.length) throw new Error(`Faltan nodos en la base: ${faltan}`)

// Renombres: nombre del nodo y toda referencia $('...') dentro de parámetros.
let texto = JSON.stringify(nodes)
for (const [viejo, nuevo] of Object.entries(RENOMBRES))
  texto = texto.split(`"${viejo}"`).join(`"${nuevo}"`).split(`$('${viejo}')`).join(`$('${nuevo}')`)
// Chatwoot cuenta 1 -> 3, y phone ID de 321 -> Laundry VIP.
texto = texto
  .split('/api/v1/accounts/1/')
  .join('/api/v1/accounts/3/')
  .split(PHONE_321)
  .join(PHONE_LVIP)
nodes = JSON.parse(texto)
const nodo = (nombre) => nodes.find((n) => n.name === nombre)

// Identidad nueva: ids y webhookIds propios para no chocar con 321.
for (const n of nodes) {
  n.id = crypto.randomUUID()
  if (n.webhookId) n.webhookId = crypto.randomUUID()
  const tipos = Object.keys(n.credentials || {})
  if (tipos.includes('openAiApi')) n.credentials = CRED.openai
  else if (tipos.includes('postgres')) n.credentials = CRED.postgres
  else if (n.name === 'Typing Indicator') n.credentials = CRED.meta
  else if (tipos.includes('httpHeaderAuth')) n.credentials = CRED.chatwoot
}

nodo('Chatwoot Webhook').parameters.path = 'laundry-vip'

for (const a of nodo('WhatsApp Inicio').parameters.assignments.assignments) {
  if (a.name === '_chatwoot_account_id') a.value = '=3'
  if (a.name === '_chatwoot_inbox_id') a.value = '={{ $json.body.inbox?.id || 0 }}'
}

// Sin tabla meta_referrals todavía (número de prueba): misma forma de fila, sin pg_sleep.
nodo('Buscar Referral').parameters = {
  operation: 'executeQuery',
  query:
    "SELECT ''::text AS headline, ''::text AS body, ''::text AS source_url, ''::text AS image_url, ''::text AS ctwa_clid, ''::text AS ad_id, ''::text AS service_type_inferred, '{}'::text AS ad_image_analysis",
  options: {},
}

// Transcripción: gpt-transcribe por HTTP (el nodo de OpenAI usa whisper-1 fijo).
Object.assign(nodo('Transcribir Audio'), {
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  parameters: {
    method: 'POST',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'openAiApi',
    sendBody: true,
    contentType: 'multipart-form-data',
    bodyParameters: {
      parameters: [
        { name: 'model', value: 'gpt-transcribe' },
        { name: 'language', value: 'es' },
        { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' },
      ],
    },
    options: { timeout: 30000 },
  },
})

// Visión: hechos estructurados, el agente interpreta con la conversación.
nodo('Explicar Imagen').parameters.text =
  `=Eres el extractor de hechos de imágenes de Lavandería VIP. NO interpretes ni converses: solo reporta lo que se ve.
Texto que acompañó la imagen: "{{ $('WhatsApp Inicio').item.json.messages[0].image.caption }}"

Responde EXACTAMENTE en este formato, empezando por la primera línea:
[IMAGEN RECIBIDA]
tipo_de_imagen: prendas | mancha | comprobante | documento | otro
prendas_visibles: lista de prendas que se ven (vacía si no hay)
cantidad_estimada: número aproximado de prendas (0 si no aplica)
manchas: [{prenda, zona, aspecto}] o ninguna
texto_legible: monto, fecha, banco, referencia u otro texto visible; "ninguno" si no hay
texto_del_cliente: el texto que acompañó la imagen

Nunca afirmes que un pago está confirmado ni que una mancha saldrá.`

// Agente: constitución de la lavandería.
const prompt = fs.readFileSync(`${REPO}/n8n/prompt-agente-laundry.md`, 'utf8')
const agente = nodo('Agente Laundry VIP')
agente.parameters.options.systemMessage = prompt.replace(/\n$/, '')
nodo('Memory Laundry').parameters.tableName = 'n8n_laundry_chat_histories'

// Parser: se conserva; solo cambia el mensaje de caída.
const extraer = nodo('Extraer JSON')
extraer.parameters.jsCode = extraer.parameters.jsCode
  .replace(
    'Permitame un momento, le contacta un asesor.',
    'Permítame un momento, le contacta una persona de nuestro equipo.',
  )
  .replace('del Agente Arqui 321 V2', 'del Agente Laundry VIP')

// Escalamiento: lee el flag ya parseado, no vuelve a hacer JSON.parse del output.
nodo('Necesita Humano?').parameters.conditions.conditions[0].leftValue =
  "={{ $('Extraer JSON').item.json.escalar_humano }}"
nodo('Nota Escalamiento').parameters.jsonBody = nodo(
  'Nota Escalamiento',
).parameters.jsonBody.replace(/\\n📢 Desde anuncio:.*?'NO' }}/, '')

// Debounce: en n8n está en 7 s (se bajó a mano desde los 30 s del 321). El repo lo refleja
// para que regenerar el JSON no lo devuelva a 30.
nodo('Debounce').parameters.amount = 7

// Typing indicator: si Meta falla, el cliente igual recibe respuesta.
nodo('Typing Indicator').onError = 'continueRegularOutput'

// Tools del agente de clientes contra el CRM.
const TOOLS = require('./herramientas-cliente.cjs').agregar(nodes)

// Posiciones del tramo final, que ahora es corto.
nodo('Calculator').position = [2580, 752]
nodo('Extraer JSON').position = [2700, 288]
nodo('Enviar Respuesta Chatwoot').position = [2960, 400]
nodo('Necesita Humano?').position = [2960, 96]
nodo('Etiqueta Humano').position = [3200, 80]
nodo('Nota Escalamiento').position = [3440, 80]

const main = (...destinos) => ({
  main: [destinos.map((d) => ({ node: d, type: 'main', index: 0 }))],
})
const ai = (tipo, destino) => ({ [tipo]: [[{ node: destino, type: tipo, index: 0 }]] })
const A = 'Agente Laundry VIP'
const connections = {
  'Chatwoot Webhook': main('Filtro Chatwoot'),
  'Filtro Chatwoot': main('Filtro Humano'),
  'Filtro Humano': main('WhatsApp Inicio'),
  'WhatsApp Inicio': main('Buscar Referral'),
  'Buscar Referral': main('Agregar Referral'),
  'Agregar Referral': main('Debounce'),
  Debounce: main('Obtener Ultimos Mensajes'),
  'Obtener Ultimos Mensajes': main('Es Ultimo Mensaje?'),
  'Es Ultimo Mensaje?': main('Combinar Textos'),
  'Combinar Textos': main('Tipo de Mensaje'),
  'Tipo de Mensaje': {
    main: [
      [{ node: 'Obtener URL Audio', type: 'main', index: 0 }],
      [{ node: 'Obtener URL Imagen', type: 'main', index: 0 }],
      [{ node: 'Espera Texto', type: 'main', index: 0 }],
    ],
  },
  'Obtener URL Audio': main('Descargar Audio'),
  'Descargar Audio': main('Transcribir Audio'),
  'Transcribir Audio': main('Preparar Mensaje Final'),
  'Obtener URL Imagen': main('Descargar Imagen'),
  'Descargar Imagen': main('Explicar Imagen'),
  'Explicar Imagen': main('Preparar Mensaje Final'),
  'OpenAI Vision': ai('ai_languageModel', 'Explicar Imagen'),
  'Espera Texto': main('Preparar Mensaje Final'),
  'Preparar Mensaje Final': main('Typing Indicator'),
  'Typing Indicator': main(A),
  'OpenAI Laundry': ai('ai_languageModel', A),
  'Memory Laundry': ai('ai_memory', A),
  Calculator: ai('ai_tool', A),
  [A]: main('Extraer JSON'),
  'Extraer JSON': main('Enviar Respuesta Chatwoot', 'Necesita Humano?', 'Preparar CRM Body'),
  'Necesita Humano?': main('Etiqueta Humano'),
  'Etiqueta Humano': main('Nota Escalamiento'),
}
for (const [nombre] of TOOLS) connections[nombre] = ai('ai_tool', A)

// Modo operador (lista blanca de planta).
require('./operador.cjs').aplicar({ nodes, connections, nodo, REPO })

// Guardia anti-alucinación de confirmaciones.
require('./guardia.cjs').aplicar({ nodo })

// Rama CRM (patrón del CRM WEB de 321).
const crm = require('./crm.cjs')
nodes.push(...crm.nodos)
Object.assign(connections, crm.conexiones)

// Resumen diario de las 8:00 para los admins.
const resumen = require('./resumen.cjs')
nodes.push(...resumen.nodos)
Object.assign(connections, resumen.conexiones)

// Coexistencia persona–agente: si una persona contesta a mano, el agente se calla.
const persona = require('./persona.cjs')
nodes.push(...persona.nodos)
Object.assign(connections, persona.conexiones)
connections['Chatwoot Webhook'].main[0].push({ node: 'Respondio Persona?', type: 'main', index: 0 })

// Protecciones del CRM: tope de mensajes, deduplicación y tope de gasto (B2).
const protecciones = require('./protecciones.cjs')
nodes.push(...protecciones.nodos)
Object.assign(connections, protecciones.conexiones)
connections['Extraer JSON'].main[0].push({ node: 'Estimar Uso', type: 'main', index: 0 })

// Agente de seguimiento: retoma a quien pidió precio y no contestó.
const seguimiento = require('./seguimiento.cjs')
nodes.push(...seguimiento.nodos)
Object.assign(connections, seguimiento.conexiones)

// Aviso automático al cliente por una discrepancia de conteo o de monto.
const avisos = require('./avisos.cjs')
nodes.push(...avisos.nodos)
Object.assign(connections, avisos.conexiones)

const nombres = new Set(nodes.map((n) => n.name))
for (const [origen, tipos] of Object.entries(connections)) {
  if (!nombres.has(origen)) throw new Error(`Conexión desde nodo inexistente: ${origen}`)
  for (const salidas of Object.values(tipos))
    for (const s of salidas)
      for (const c of s) if (!nombres.has(c.node)) throw new Error(`Destino inexistente: ${c.node}`)
}

const salida = {
  name: 'iAgente Laundry VIP',
  nodes,
  pinData: {},
  connections,
  active: false,
  settings: { ...w.settings, availableInMCP: true },
  tags: [],
}
fs.writeFileSync(
  `${REPO}/n8n/workflows/laundry-vip-agente.json`,
  `${JSON.stringify(salida, null, 2)}\n`,
)
console.log(`OK: ${nodes.length} nodos`)
