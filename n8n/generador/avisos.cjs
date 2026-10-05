// Aviso automático al cliente por una discrepancia (conteo que no cuadra o monto
// corregido). Decisión del dueño, 2026-09-30. El texto lo arma el CRM con cifras de
// la base: aquí solo se entrega. Dentro de la ventana de 24 h de WhatsApp se manda
// al cliente; fuera, texto libre no se puede: queda una nota interna para que una
// persona lo llame. Nunca pide ni recibe dinero.
const crypto = require('node:crypto')
const CRM_URL = 'https://laundry-vip.vercel.app/api/webhook'
const CW = 'https://chatwoot-production-8564.up.railway.app/api/v1/accounts/3/conversations'
const CRED_CRM = { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } }
const CRED_CW = { httpHeaderAuth: { id: '3W2BykSid0f9dMTV', name: 'Chatwoot Laundry VIP API' } }

const unoPorAviso = `// Un elemento por aviso pendiente.
const r = $input.first().json || {};
return ((r.data && r.data.avisos) || []).map((a) => ({ json: a }));`

const crm = (name, cuerpo, position) => ({
  parameters: {
    method: 'POST',
    url: CRM_URL,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify(${cuerpo}) }}`,
    options: { timeout: 15000, response: { response: { neverError: true } } },
  },
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  id: crypto.randomUUID(),
  credentials: CRED_CRM,
  onError: 'continueRegularOutput',
})

const chatwoot = (name, contenido, privado, position) => ({
  parameters: {
    method: 'POST',
    url: `=${CW}/{{ $('Uno por Aviso').item.json.chatwoot_conversation_id }}/messages`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({ content: ${contenido}, message_type: 'outgoing', private: ${privado} }) }}`,
    options: { timeout: 10000 },
  },
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  id: crypto.randomUUID(),
  credentials: CRED_CW,
  onError: 'continueRegularOutput',
})

const nodos = [
  {
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '*/5 9-18 * * 1-6' }] },
    },
    name: 'Avisos cada 5 min',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [-2000, 2400],
    id: crypto.randomUUID(),
    notes: 'Lunes a sábado, 9:00 a 18:55 (zona America/Guayaquil).',
  },
  crm('Avisos Pendientes', "{ accion: 'avisos_pendientes', parametros: {} }", [-1760, 2400]),
  {
    parameters: { jsCode: unoPorAviso },
    name: 'Uno por Aviso',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-1520, 2400],
    id: crypto.randomUUID(),
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'ventana-abierta',
            leftValue: '={{ $json.ventana_abierta === true && !!$json.chatwoot_conversation_id }}',
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: 'Ventana Abierta?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [-1280, 2400],
    id: crypto.randomUUID(),
  },
  chatwoot('Enviar Aviso al Cliente', "$('Uno por Aviso').item.json.texto", 'false', [-1040, 2300]),
  crm(
    'Marcar Aviso Enviado',
    "{ accion: 'marcar_aviso', parametros: { id: $('Uno por Aviso').item.json.id, estado: 'enviado' } }",
    [-800, 2300],
  ),
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'hay-conversacion',
            leftValue: '={{ !!$json.chatwoot_conversation_id }}',
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: 'Hay Conversacion?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [-1160, 2500],
    id: crypto.randomUUID(),
    notes:
      'Un aviso sin conversación de Chatwoot no puede dejar nota (daba 404): solo se marca como requiere_persona.',
  },
  chatwoot(
    'Nota Aviso Manual',
    "'⚠️ Hay una diferencia en el pedido de este cliente y no pude avisarle por WhatsApp: pasaron más de 24 h desde su último mensaje, y fuera de ese plazo WhatsApp solo deja mandar plantillas aprobadas. Llámelo o escríbale usted. Esto es lo que el sistema le diría:\\n\\n' + $('Uno por Aviso').item.json.texto",
    'true',
    [-1040, 2500],
  ),
  crm(
    'Marcar Aviso Persona',
    "{ accion: 'marcar_aviso', parametros: { id: $('Uno por Aviso').item.json.id, estado: 'requiere_persona' } }",
    [-800, 2500],
  ),
]

const main = (d) => ({ main: [[{ node: d, type: 'main', index: 0 }]] })
const conexiones = {
  'Avisos cada 5 min': main('Avisos Pendientes'),
  'Avisos Pendientes': main('Uno por Aviso'),
  'Uno por Aviso': main('Ventana Abierta?'),
  'Ventana Abierta?': {
    main: [
      [{ node: 'Enviar Aviso al Cliente', type: 'main', index: 0 }],
      [{ node: 'Hay Conversacion?', type: 'main', index: 0 }],
    ],
  },
  'Hay Conversacion?': {
    main: [
      [{ node: 'Nota Aviso Manual', type: 'main', index: 0 }],
      [{ node: 'Marcar Aviso Persona', type: 'main', index: 0 }],
    ],
  },
  'Enviar Aviso al Cliente': main('Marcar Aviso Enviado'),
  'Nota Aviso Manual': main('Marcar Aviso Persona'),
}

module.exports = { nodos, conexiones }
