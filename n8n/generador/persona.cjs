// Coexistencia persona–agente (B1): si una persona del equipo le contesta a un
// cliente a mano en Chatwoot, el agente se calla en esa conversación.
// Rama paralela a la del cliente, desde el mismo webhook: mensaje saliente,
// público, de un usuario de Chatwoot que no es el agente → etiqueta «humano».
// El agente publica con su propio usuario de Chatwoot («Agente VIP», desde el
// 2026-10-01); cualquier otro remitente, incluido Byron, es una persona.
const crypto = require('node:crypto')
const { NOMBRE_AGENTE: AGENTE } = require('./agente.cjs')
const BASE = 'https://chatwoot-production-8564.up.railway.app/api/v1/accounts/3/conversations'
const CRED = { httpHeaderAuth: { id: '3W2BykSid0f9dMTV', name: 'Chatwoot Laundry VIP API' } }

const condicion = (id, leftValue, rightValue, operation = 'equals') => ({
  id,
  leftValue,
  rightValue,
  operator: { type: 'string', operation },
})

const http = (name, jsonBody, position) => ({
  parameters: {
    method: 'POST',
    url: `=${BASE}/{{ $('Chatwoot Webhook').item.json.body.conversation.id }}/${jsonBody.ruta}`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: jsonBody.cuerpo,
    options: { timeout: 5000 },
  },
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  id: crypto.randomUUID(),
  credentials: CRED,
  continueOnFail: true,
})

const nodos = [
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          condicion('p001', '={{ $json.body.event }}', 'message_created'),
          condicion('p002', '={{ $json.body.message_type }}', 'outgoing'),
          condicion('p003', '={{ String($json.body.private) }}', 'false'),
          condicion('p004', '={{ $json.body.sender?.type }}', 'user'),
          condicion('p005', '={{ $json.body.sender?.name }}', AGENTE, 'notEquals'),
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: 'Respondio Persona?',
    type: 'n8n-nodes-base.if',
    position: [-1776, 160],
    typeVersion: 2.2,
    id: crypto.randomUUID(),
  },
  // La API de etiquetas REEMPLAZA el conjunto: se conservan las que ya tenía.
  http(
    'Etiqueta Humano Persona',
    {
      ruta: 'labels',
      cuerpo:
        "={{ JSON.stringify({ labels: [...new Set([...($('Chatwoot Webhook').item.json.body.conversation?.labels || []), 'humano'])] }) }}",
    },
    [-1552, 160],
  ),
  http(
    'Nota Persona',
    {
      ruta: 'messages',
      cuerpo:
        "={{ JSON.stringify({ content: '🙋 ' + $('Chatwoot Webhook').item.json.body.sender.name + ' tomó esta conversación; el agente se retiró. Para devolverle el control, quita la etiqueta *humano*.', message_type: 'outgoing', private: true }) }}",
    },
    [-1328, 160],
  ),
]

const conexiones = {
  'Respondio Persona?': { main: [[{ node: 'Etiqueta Humano Persona', type: 'main', index: 0 }]] },
  'Etiqueta Humano Persona': { main: [[{ node: 'Nota Persona', type: 'main', index: 0 }]] },
}

module.exports = { nodos, conexiones, AGENTE }
