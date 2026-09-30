// Agente de seguimiento: retoma a quien pidió precio y dejó de contestar, dentro
// de la ventana de 24 h de WhatsApp. Son cuatro mensajes, a los 30 min, 1 h, 6 h y
// 23 h 30 min de silencio; si en ese lapso no contrata, no se insiste más.
// Cada 5 minutos en horario del local:
//   CRM decide a quién (y en qué modo: apagado / borrador / activo)
//   → Chatwoot confirma que ninguna persona se hizo cargo (etiqueta o respuesta a mano)
//   → OpenAI redacta un mensaje corto con lo que ya se habló
//   → una guardia descarta cualquier precio que no sea el ya dicho
//   → borrador: nota interna · activo: mensaje al cliente → se anota en el CRM.
const crypto = require('node:crypto')
const CRM_URL = 'https://laundry-vip.vercel.app/api/webhook'
const CW = 'https://chatwoot-production-8564.up.railway.app/api/v1/accounts/3/conversations'
const CRED_CRM = { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } }
const CRED_CW = { httpHeaderAuth: { id: '3W2BykSid0f9dMTV', name: 'Chatwoot Laundry VIP API' } }
const CRED_OPENAI = { openAiApi: { id: 'GvNmUCZRx5ZvZerQ', name: 'OpenAi account' } }

const SISTEMA = `Escribes por WhatsApp a nombre de una lavandería de barrio en La Kennedy, Quito. Un cliente pidió información o precio y dejó de contestar. Te digo cuál de cuatro seguimientos es y qué busca. Redacta UN mensaje corto (máximo 35 palabras) para retomar la conversación.
Reglas: trátalo de usted, con calidez y sin presionar. Retoma lo que él pidió con sus propias palabras y ofrece el siguiente paso concreto (agendar la recogida, resolver una duda). No repitas ni parafrasees los seguimientos que ya le mandamos. No inventes precios, fechas ni promociones: si mencionas un monto, tiene que ser uno que ya se le dijo. Usa su nombre solo si te lo doy. No digas que eres un asistente, un bot o un sistema, ni pidas disculpas por escribir. Sin emojis. Responde solo con el texto del mensaje.`

const GUIA = {
  1: 'Un recordatorio suave y breve: pregunta si pudo ver el precio o si le quedó alguna duda.',
  2: 'Ofrece resolver lo que lo frena: una duda del servicio, del precio o de cómo funciona la recogida.',
  3: 'Propón algo concreto y fácil: agendar la recogida para mañana o que traiga la ropa al local.',
  4: 'Último mensaje. Cordial y sin presión: avisa que queda a su disposición si más adelante lo necesita. No propongas más pasos ni insistas.',
}

const PROMPT_USUARIO = `={{ JSON.stringify({
  model: 'gpt-4.1-mini',
  temperature: 0.7,
  max_tokens: 120,
  messages: [
    { role: 'system', content: ${JSON.stringify(SISTEMA)} },
    { role: 'user', content: [
      'Nombre: ' + ($('Uno por Candidato').item.json.nombre || '(no lo sabemos: no uses ninguno)'),
      'Lo que necesita: ' + $('Uno por Candidato').item.json.necesidad,
      'Lo último que escribió: ' + $('Uno por Candidato').item.json.ultimo_mensaje_cliente,
      'Lo último que le respondimos: ' + $('Uno por Candidato').item.json.ultima_respuesta_agente,
      'Seguimiento número ' + $('Uno por Candidato').item.json.paso + ' de 4. ' + (${JSON.stringify(GUIA)})[$('Uno por Candidato').item.json.paso],
      'Seguimientos que ya le mandamos: ' + ($('Uno por Candidato').item.json.anteriores.join(' | ') || '(ninguno)'),
    ].join('\\n') },
  ],
}) }}`

const armar = `// Guardia: el modelo puede colar un precio que nadie dijo. Solo valen los montos
// que ya estaban en lo último que se le respondió al cliente.
const c = $('Uno por Candidato').item.json;
let texto = String(($json.choices && $json.choices[0] && $json.choices[0].message && $json.choices[0].message.content) || '').trim();
texto = texto.replace(/^["«]|["»]$/g, '').trim();
if (texto === '') return [];
const montos = texto.match(/\\$\\s?\\d+(?:[.,]\\d+)?/g) || [];
const dichos = String(c.ultima_respuesta_agente || '');
if (montos.some((m) => !dichos.includes(m.replace(/\\s/g, '')))) return [];
const privado = c.modo !== 'activo';
return [{ json: {
  texto,
  privado,
  paso: c.paso,
  contenido: privado ? '📝 Borrador de seguimiento (NO se envió al cliente). Si le sirve, cópielo y envíelo:\\n\\n' + texto : texto,
} }];`

const unoPorCandidato = `// Un elemento por cliente a retomar, con el modo en que trabaja el CRM.
const r = $input.first().json || {};
const d = r.data || {};
return (d.candidatos || []).map((c) => ({ json: { ...c, modo: d.modo } }));`

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

const nodos = [
  {
    parameters: {
      rule: { interval: [{ field: 'cronExpression', expression: '*/5 9-18 * * 1-6' }] },
    },
    name: 'Seguimiento cada 5 min',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [-2000, 1600],
    id: crypto.randomUUID(),
    notes:
      'Lunes a sábado, 9:00 a 18:55 (zona America/Guayaquil). El CRM además revisa el horario del local y decide qué paso toca.',
  },
  crm(
    'Candidatos Seguimiento',
    "{ accion: 'candidatos_seguimiento', parametros: {} }",
    [-1760, 1600],
  ),
  {
    parameters: { jsCode: unoPorCandidato },
    name: 'Uno por Candidato',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-1520, 1600],
    id: crypto.randomUUID(),
  },
  {
    parameters: {
      url: `=${CW}/{{ $json.chatwoot_conversation_id }}`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: { timeout: 10000 },
    },
    name: 'Conversacion Seguimiento',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [-1280, 1600],
    id: crypto.randomUUID(),
    credentials: CRED_CW,
    onError: 'continueRegularOutput',
  },
  {
    parameters: {
      url: `=${CW}/{{ $('Uno por Candidato').item.json.chatwoot_conversation_id }}/messages`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: { timeout: 10000 },
    },
    name: 'Mensajes Seguimiento',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [-1160, 1600],
    id: crypto.randomUUID(),
    credentials: CRED_CW,
    onError: 'continueRegularOutput',
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'sin-persona',
            // Fuera si hay una persona a cargo: etiqueta humano, conversación resuelta o
            // un mensaje de alguien del equipo en las últimas 24 h (ya le contestaron).
            leftValue: `={{ (() => {
  const conv = $('Conversacion Seguimiento').item.json;
  const mensajes = $json.payload || [];
  const hace24h = Date.now() / 1000 - 24 * 3600;
  const persona = mensajes.some((m) => m.message_type === 1 && !m.private && m.sender && m.sender.type === 'user' && m.sender.name !== 'Byron ADMIN' && m.created_at > hace24h);
  return conv.id !== undefined && !(conv.labels || []).includes('humano') && conv.status !== 'resolved' && !persona;
})() }}`,
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: 'Sin Persona a Cargo?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [-1040, 1600],
    id: crypto.randomUUID(),
  },
  {
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: PROMPT_USUARIO,
      options: { timeout: 30000 },
    },
    name: 'Redactar Seguimiento',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [-800, 1600],
    id: crypto.randomUUID(),
    credentials: CRED_OPENAI,
    onError: 'continueRegularOutput',
  },
  {
    parameters: { jsCode: armar },
    name: 'Armar Seguimiento',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-560, 1600],
    id: crypto.randomUUID(),
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
        '={{ JSON.stringify({ content: $json.contenido, message_type: "outgoing", private: $json.privado }) }}',
      options: { timeout: 10000 },
    },
    name: 'Enviar Seguimiento',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [-320, 1600],
    id: crypto.randomUUID(),
    credentials: CRED_CW,
    onError: 'continueRegularOutput',
  },
  {
    parameters: {
      operation: 'executeQuery',
      // Solo en modo activo: un borrador nunca llegó al cliente y el agente no debe creer que sí.
      query:
        "INSERT INTO n8n_laundry_chat_histories (session_id, message) SELECT $1, $2::jsonb WHERE $3 = 'activo'",
      options: {
        queryReplacement:
          "={{ [$('Uno por Candidato').item.json.telefono.replace(/[^0-9]/g, ''), JSON.stringify({ type: 'ai', data: { content: $('Armar Seguimiento').item.json.texto, additional_kwargs: {}, response_metadata: {} } }), $('Uno por Candidato').item.json.modo] }}",
      },
    },
    name: 'Guardar Seguimiento en Memoria',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [-200, 1600],
    id: crypto.randomUUID(),
    credentials: { postgres: { id: 'uS6oHAzjK8OQg6K3', name: 'Postgres Laundry VIP' } },
    onError: 'continueRegularOutput',
    notes:
      'Como el follow-up de 321: lo que se le escribió al cliente queda en la memoria del agente.',
  },
  crm(
    'Anotar Seguimiento',
    `{ accion: 'registrar_seguimiento', parametros: { telefono: $('Uno por Candidato').item.json.telefono, chatwoot_conversation_id: $('Uno por Candidato').item.json.chatwoot_conversation_id, modo: $('Uno por Candidato').item.json.modo === 'activo' ? 'activo' : 'borrador', paso: $('Uno por Candidato').item.json.paso, mensaje: $('Armar Seguimiento').item.json.texto, interaccion_base: $('Uno por Candidato').item.json.interaccion_base } }`,
    [40, 1600],
  ),
]

const main = (d) => ({ main: [[{ node: d, type: 'main', index: 0 }]] })
const conexiones = {
  'Seguimiento cada 5 min': main('Candidatos Seguimiento'),
  'Candidatos Seguimiento': main('Uno por Candidato'),
  'Uno por Candidato': main('Conversacion Seguimiento'),
  'Conversacion Seguimiento': main('Mensajes Seguimiento'),
  'Mensajes Seguimiento': main('Sin Persona a Cargo?'),
  'Sin Persona a Cargo?': main('Redactar Seguimiento'),
  'Redactar Seguimiento': main('Armar Seguimiento'),
  'Armar Seguimiento': main('Enviar Seguimiento'),
  'Enviar Seguimiento': main('Guardar Seguimiento en Memoria'),
  'Guardar Seguimiento en Memoria': main('Anotar Seguimiento'),
}

module.exports = { nodos, conexiones }
