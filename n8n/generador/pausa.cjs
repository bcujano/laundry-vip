// Vencimiento de la pausa (Anexo A, regla 2 de María Sol): si una persona tomó el chat (etiqueta
// «humano») y pasaron 3 horas hábiles sin que nadie del equipo escriba, el agente retoma cuando el
// cliente vuelve a escribir. En los 7 casos delicados (reclamo, dinero, empresa, molesto, cobertura,
// menor, sospechoso) nunca vence sola. La decisión la calcula el servidor (evaluar_pausa), no el modelo.
//
//   Filtro Humano (tiene «humano») → Mensajes Para Pausa → Pausa Vencida → ¿Retomar Pausa?
//        sí → Quitar Humano → Nota Retomo → Restaurar Evento → WhatsApp Inicio (el flujo normal)
const crypto = require('node:crypto')
const { NOMBRE_AGENTE: AGENTE } = require('./agente.cjs')

const BASE = 'https://chatwoot-production-8564.up.railway.app/api/v1/accounts/3/conversations'
const CRED_CW = { httpHeaderAuth: { id: '3W2BykSid0f9dMTV', name: 'Chatwoot Laundry VIP API' } }
const CRED_CRM = { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } }
const CONVERSACION = "{{ $('Chatwoot Webhook').first().json.body.conversation.id }}"

const ULTIMA_PERSONA = `(() => {
  const p = $('Mensajes Para Pausa').first().json.payload;
  if (!Array.isArray(p)) return new Date().toISOString();
  const t = Math.max(0, ...p.filter((x) => x.message_type === 1 && !x.private && (x.sender?.name || '') !== '${AGENTE}').map((x) => x.created_at || 0));
  return t ? new Date(t * 1000).toISOString() : undefined;
})()`

const http = (name, metodo, url, jsonBody, credentials, position) => ({
  parameters: {
    method: metodo,
    url,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    ...(jsonBody ? { sendBody: true, specifyBody: 'json', jsonBody } : {}),
    options: { timeout: 8000 },
  },
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  id: crypto.randomUUID(),
  credentials,
  onError: 'continueRegularOutput',
})

function aplicar({ nodes, connections }) {
  const [x, y] = [-1552, 700]
  nodes.push(
    http('Mensajes Para Pausa', 'GET', `=${BASE}/${CONVERSACION}/messages`, null, CRED_CW, [x, y]),
    http(
      'Pausa Vencida',
      'POST',
      'https://laundry-vip.vercel.app/api/webhook',
      `={{ JSON.stringify({ accion: 'evaluar_pausa', parametros: { etiquetas: $('Chatwoot Webhook').first().json.body?.conversation?.labels || [], ultima_persona_en: ${ULTIMA_PERSONA} } }) }}`,
      CRED_CRM,
      [x + 224, y],
    ),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [
            {
              id: 'retomar',
              leftValue: '={{ $json.data?.retomar === true }}',
              rightValue: '',
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
      name: '¿Retomar Pausa?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [x + 448, y],
      id: crypto.randomUUID(),
    },
    http(
      'Quitar Humano',
      'POST',
      `=${BASE}/${CONVERSACION}/labels`,
      "={{ JSON.stringify({ labels: ($('Chatwoot Webhook').first().json.body?.conversation?.labels || []).filter((e) => e !== 'humano') }) }}",
      CRED_CW,
      [x + 672, y],
    ),
    http(
      'Nota Retomo',
      'POST',
      `=${BASE}/${CONVERSACION}/messages`,
      '={{ JSON.stringify({ content: "🤖 Pasaron 3 horas hábiles sin respuesta del equipo y el cliente sigue escribiendo: el agente retoma la conversación y lee lo que ya se habló. Para pausarlo otra vez, pon la etiqueta humano.", message_type: "outgoing", private: true }) }}',
      CRED_CW,
      [x + 896, y],
    ),
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: "return [{ json: $('Chatwoot Webhook').first().json }];",
      },
      name: 'Restaurar Evento',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [x + 1120, y],
      id: crypto.randomUUID(),
      notes: 'Devuelve el evento original del webhook para que el flujo normal siga como si nada.',
    },
  )

  const a = (nodo) => [{ node: nodo, type: 'main', index: 0 }]
  // Filtro Humano: salida 0 = sin etiqueta (flujo normal), salida 1 = tiene «humano».
  connections['Filtro Humano'].main[1] = a('Mensajes Para Pausa')
  connections['Mensajes Para Pausa'] = { main: [a('Pausa Vencida')] }
  connections['Pausa Vencida'] = { main: [a('¿Retomar Pausa?')] }
  connections['¿Retomar Pausa?'] = { main: [a('Quitar Humano'), []] }
  connections['Quitar Humano'] = { main: [a('Nota Retomo')] }
  connections['Nota Retomo'] = { main: [a('Restaurar Evento')] }
  connections['Restaurar Evento'] = { main: [a('WhatsApp Inicio')] }
}

module.exports = { aplicar }
