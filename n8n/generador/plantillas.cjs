// Mensajes automáticos por plantilla de Meta (fase 5 de Sol): reactivación de clientes inactivos y
// aviso de ropa que no se retira. Una vez al día, de lunes a sábado a las 10:00 (America/Guayaquil).
// El CRM decide a quién (y devuelve la lista vacía mientras el interruptor de Configuración esté
// apagado); aquí solo se entrega. Si Meta rechaza el envío (p. ej. plantilla aún en revisión), no se
// marca como enviado y se intenta de nuevo al día siguiente.
//
//   Plantillas 10:00 → Plantillas Pendientes → Uno por Plantilla → Enviar Plantilla → ¿Se Envió? → Marcar Plantilla
const crypto = require('node:crypto')

const CRM_URL = 'https://laundry-vip.vercel.app/api/webhook'
const GRAPH = 'https://graph.facebook.com/v22.0/1220603671147410/messages'
const CRED_CRM = { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } }
const CRED_META = { httpHeaderAuth: { id: 'baJJfX3zWMindSEN', name: 'Meta WhatsApp Laundry VIP' } }

const crm = (name, cuerpo, position) => ({
  parameters: {
    method: 'POST',
    url: CRM_URL,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify(${cuerpo}) }}`,
    options: { timeout: 20000, response: { response: { neverError: true } } },
  },
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  id: crypto.randomUUID(),
  credentials: CRED_CRM,
  onError: 'continueRegularOutput',
})

const UNO_POR_PLANTILLA = `// Un elemento por envío. El CRM devuelve la lista vacía si el interruptor está apagado.
const r = $input.first().json || {};
return ((r.data && r.data.envios) || []).map((e) => ({ json: e }));`

const nodos = [
  {
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 10 * * 1-6' }] } },
    name: 'Plantillas 10:00',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [-2000, 3200],
    id: crypto.randomUUID(),
    notes: 'Lunes a sábado a las 10:00 (America/Guayaquil).',
  },
  crm(
    'Plantillas Pendientes',
    "{ accion: 'plantillas_pendientes', parametros: {} }",
    [-1760, 3200],
  ),
  {
    parameters: { jsCode: UNO_POR_PLANTILLA },
    name: 'Uno por Plantilla',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-1520, 3200],
    id: crypto.randomUUID(),
  },
  {
    parameters: {
      method: 'POST',
      url: GRAPH,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody:
        '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.telefono.replace(/[^0-9]/g, ""), type: "template", template: { name: $json.plantilla, language: { code: "es" }, components: [{ type: "body", parameters: $json.parametros.map((t) => ({ type: "text", text: String(t) })) }] } }) }}',
      options: { timeout: 15000, response: { response: { neverError: true } } },
    },
    name: 'Enviar Plantilla',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [-1280, 3200],
    id: crypto.randomUUID(),
    credentials: CRED_META,
    onError: 'continueRegularOutput',
    notes: 'Falla (sin marcar) mientras Meta no haya aprobado la plantilla.',
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'enviada',
            leftValue: '={{ !!$json.messages?.[0]?.id }}',
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: '¿Se Envió?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [-1040, 3200],
    id: crypto.randomUUID(),
  },
  crm(
    'Marcar Plantilla',
    "{ accion: 'marcar_plantilla', parametros: { telefono: $('Uno por Plantilla').item.json.telefono, plantilla: $('Uno por Plantilla').item.json.plantilla, clave: $('Uno por Plantilla').item.json.clave } }",
    [-800, 3200],
  ),
]

function aplicar({ nodes, connections }) {
  nodes.push(...nodos)
  const a = (n) => [{ node: n, type: 'main', index: 0 }]
  connections['Plantillas 10:00'] = { main: [a('Plantillas Pendientes')] }
  connections['Plantillas Pendientes'] = { main: [a('Uno por Plantilla')] }
  connections['Uno por Plantilla'] = { main: [a('Enviar Plantilla')] }
  connections['Enviar Plantilla'] = { main: [a('¿Se Envió?')] }
  connections['¿Se Envió?'] = { main: [a('Marcar Plantilla'), []] }
}

module.exports = { aplicar }
