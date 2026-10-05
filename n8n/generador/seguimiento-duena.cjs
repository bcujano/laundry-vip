// Seguimiento · aviso a la dueña: con el primer seguimiento (5 min) se le manda un
// resumen del lead, por WhatsApp si cabe texto libre y siempre como nota interna.
const {
  crypto,
  CW,
  CRED_CW,
  CRED_OPENAI,
  CRED_META,
  GRAPH,
  crm,
  main,
} = require('./seguimiento-comun.cjs')

const SISTEMA_RESUMEN = `Eres el apoyo de la dueña de una lavandería. Resume en máximo 60 palabras, directo y sin saludos, para que decida si llama al cliente: quién es (el nombre solo si el cliente lo escribió), qué necesita lavar, qué precio estimado se le dio, en qué barrio está y qué falta para cerrar. No inventes datos.`

const armarAviso = `// Un mensaje por administradora, con el resumen y el enlace al chat.
const r = $input.first().json || {};
const c = $('Uno por Candidato').item.json;
const resumen = String(($('Resumir Para la Duena').item.json.choices[0].message.content) || '').trim();
const chat = 'https://chatwoot-production-8564.up.railway.app/app/accounts/3/conversations/' + c.chatwoot_conversation_id;
const texto = '🔔 Lead sin respuesta hace 5 minutos (' + c.telefono + ')\\n\\n' + resumen + '\\n\\nChat: ' + chat;
return ((r.data && r.data.admins) || []).map((a) => ({ json: { ...a, texto } }));`

const nodos = [
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'primer-aviso',
            leftValue:
              "={{ $('Uno por Candidato').item.json.paso === 1 && $('Uno por Candidato').item.json.modo === 'activo' }}",
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: 'Es Primer Aviso?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [280, 1600],
    id: crypto.randomUUID(),
    notes: 'Con el primer seguimiento (5 min) se avisa a la dueña.',
  },
  {
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={{ JSON.stringify({ model: 'gpt-4.1-mini', temperature: 0.2, max_tokens: 160, messages: [ { role: 'system', content: ${JSON.stringify(SISTEMA_RESUMEN)} }, { role: 'user', content: $('Armar Transcripcion').item.json.transcripcion || '(sin mensajes)' } ] }) }}`,
      options: { timeout: 30000 },
    },
    name: 'Resumir Para la Duena',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [520, 1600],
    id: crypto.randomUUID(),
    credentials: CRED_OPENAI,
    onError: 'continueRegularOutput',
  },
  {
    parameters: {
      method: 'POST',
      url: `=${CW}/{{ $('Uno por Candidato').item.json.chatwoot_conversation_id }}/messages`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody:
        "={{ JSON.stringify({ content: '🔔 Lead sin respuesta hace 5 minutos\\n\\n' + String(($json.choices && $json.choices[0] && $json.choices[0].message.content) || '').trim(), message_type: 'outgoing', private: true }) }}",
      options: { timeout: 10000 },
    },
    name: 'Nota Resumen',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [760, 1600],
    id: crypto.randomUUID(),
    credentials: CRED_CW,
    onError: 'continueRegularOutput',
  },
  crm('Admins Para Aviso', "{ accion: 'admins_para_aviso', parametros: {} }", [1000, 1600]),
  {
    parameters: { jsCode: armarAviso },
    name: 'Uno por Admin',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1240, 1600],
    id: crypto.randomUUID(),
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'duena-en-ventana',
            leftValue: '={{ $json.dentro_de_ventana === true }}',
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: 'Duena en Ventana?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [1480, 1600],
    id: crypto.randomUUID(),
    notes: 'Si no escribió al agente en 24 h, solo queda la nota interna del chat.',
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
        '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.telefono, type: "text", text: { body: $json.texto } }) }}',
      options: { timeout: 30000 },
    },
    name: 'Avisar a la Duena',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1720, 1600],
    id: crypto.randomUUID(),
    credentials: CRED_META,
    onError: 'continueRegularOutput',
  },
]

const conexiones = {
  'Anotar Seguimiento': main('Es Primer Aviso?'),
  'Es Primer Aviso?': main('Resumir Para la Duena'),
  'Resumir Para la Duena': main('Nota Resumen'),
  'Nota Resumen': main('Admins Para Aviso'),
  'Admins Para Aviso': main('Uno por Admin'),
  'Uno por Admin': main('Duena en Ventana?'),
  'Duena en Ventana?': main('Avisar a la Duena'),
}

module.exports = { nodos, conexiones }
