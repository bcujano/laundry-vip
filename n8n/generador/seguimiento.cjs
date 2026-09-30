// Agente de seguimiento: retoma a quien pidió precio y dejó de contestar, dentro
// de la ventana de 24 h de WhatsApp. Son cuatro mensajes, a los 30 min, 1 h, 6 h y
// 23 h 30 min de silencio; si en ese lapso no contrata, no se insiste más.
// Cada 5 minutos en horario del local:
//   CRM decide a quién (y en qué modo: apagado / borrador / activo)
//   → Chatwoot confirma que ninguna persona se hizo cargo (etiqueta o respuesta a mano)
//   → se lee la conversación y se detecta si ya contrató, agendó o dijo que no:
//     si compró se agrega al CRM y se avisa que falta el pedido; no se le insiste
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
Reglas: trátalo de usted, con calidez y sin presionar. Retoma lo que él pidió con sus propias palabras y ofrece el siguiente paso concreto (agendar la recogida, resolver una duda). No repitas ni parafrasees los seguimientos que ya le mandamos. No inventes precios, fechas ni promociones: si mencionas un monto, tiene que ser uno que ya se le dijo. Usa su nombre solo si te lo doy. No digas que eres un asistente, un bot o un sistema, ni pidas disculpas por escribir. Si saludas, usa el saludo que corresponde a la hora de Quito que te doy. Sin emojis. Responde solo con el texto del mensaje.`

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
      'Hora en Quito ahora: ' + new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(11, 16),
      'Nombre: ' + ($('Uno por Candidato').item.json.nombre || '(no lo sabemos: no uses ninguno)'),
      'Lo que necesita: ' + $('Uno por Candidato').item.json.necesidad,
      'Lo último que escribió: ' + $('Uno por Candidato').item.json.ultimo_mensaje_cliente,
      'Lo último que le respondimos: ' + $('Uno por Candidato').item.json.ultima_respuesta_agente,
      'Seguimiento número ' + $('Uno por Candidato').item.json.paso + ' de 4. ' + (${JSON.stringify(GUIA)})[$('Uno por Candidato').item.json.paso],
      'Seguimientos que ya le mandamos: ' + ($('Uno por Candidato').item.json.anteriores.join(' | ') || '(ninguno)'),
    ].join('\\n') },
  ],
}) }}`

const CLASIFICAR_SISTEMA = `Eres analista comercial de una lavandería de barrio. Lees una conversación de WhatsApp y decides cómo va la venta. Responde SOLO un JSON: {"estado": "...", "nombre": "...", "detalle": "..."}.
estado:
- "vendido": el cliente aceptó el servicio y se acordó la recogida o la entrega, o el equipo confirmó la orden.
- "agendado": se fijó día u hora de recogida o de entrega, aunque falte algo más.
- "rechazado": el cliente dijo que no, que ya no lo necesita, que lo resolvió o contrató a otra lavandería, o pidió que no le escriban.
- "abierto": sigue sin decidir, dejó de contestar sin cerrar nada, o tiene dudas. Si hay duda entre "abierto" y cualquier otro estado, responde "abierto".
Quien no fue atendido en su zona pero pudo traer la ropa al local sigue "abierto".
nombre: solo si el CLIENTE lo escribió en la conversación; si no, cadena vacía.
detalle: una frase corta con lo que se acordó o por qué rechazó.`

const transcripcion = `// La conversación tal como la vio Chatwoot, con quién dijo cada cosa.
const msgs = (($('Mensajes Seguimiento').item.json.payload) || []).slice(-40);
const lineas = msgs
  .filter((m) => String(m.content || '').trim() !== '')
  // Las notas que deja este mismo sistema (borradores, avisos) no son conversación.
  .filter((m) => !(m.private && m.sender && m.sender.name === 'Byron ADMIN'))
  .map((m) => {
    let quien;
    if (m.message_type === 0) quien = 'CLIENTE';
    else if (m.private) quien = 'NOTA INTERNA';
    else if (m.sender && m.sender.name === 'Byron ADMIN') quien = 'AGENTE';
    else quien = 'EQUIPO (' + ((m.sender && m.sender.name) || 'persona') + ')';
    return quien + ': ' + String(m.content).replace(/\\s+/g, ' ').slice(0, 500);
  });
return [{ json: { transcripcion: lineas.join('\\n') } }];`

const leerClasificacion = `// Si la respuesta no se entiende, la conversación sigue abierta: ante la duda se hace seguimiento.
let r = { estado: 'abierto', nombre: '', detalle: '' };
try {
  const j = JSON.parse($json.choices[0].message.content);
  if (['vendido', 'agendado', 'rechazado', 'abierto'].includes(j.estado)) {
    r = { estado: j.estado, nombre: String(j.nombre || '').trim().slice(0, 120), detalle: String(j.detalle || '').slice(0, 300) };
  }
} catch (e) {}
return [{ json: r }];`

const armar = `// Guardia: el modelo puede colar un precio que nadie dijo. Solo valen los montos
// que ya estaban en lo último que se le respondió al cliente.
const c = $('Uno por Candidato').item.json;
let texto = String(($json.choices && $json.choices[0] && $json.choices[0].message && $json.choices[0].message.content) || '').trim();
texto = texto.replace(/^["«]|["»]$/g, '').trim();
// El saludo lo corrige el código y no el modelo: a las 5 de la tarde ya dijo «buenos días».
const hora = new Date(Date.now() - 5 * 3600 * 1000).getUTCHours();
const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
texto = texto.replace(/^(buenos d[ií]as|buenas tardes|buenas noches)/i, saludo);
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
    parameters: { jsCode: transcripcion },
    name: 'Armar Transcripcion',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-800, 1850],
    id: crypto.randomUUID(),
    onError: 'continueRegularOutput',
  },
  {
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={{ JSON.stringify({ model: 'gpt-4.1-mini', temperature: 0, max_tokens: 150, response_format: { type: 'json_object' }, messages: [ { role: 'system', content: ${JSON.stringify(CLASIFICAR_SISTEMA)} }, { role: 'user', content: $json.transcripcion || '(sin mensajes)' } ] }) }}`,
      options: { timeout: 30000 },
    },
    name: 'Clasificar Conversion',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [-560, 1850],
    id: crypto.randomUUID(),
    credentials: CRED_OPENAI,
    onError: 'continueRegularOutput',
  },
  {
    parameters: { jsCode: leerClasificacion },
    name: 'Leer Clasificacion',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-320, 1850],
    id: crypto.randomUUID(),
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'sigue-abierto',
            leftValue: "={{ $json.estado === 'abierto' }}",
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: 'Sigue Abierto?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [-80, 1850],
    id: crypto.randomUUID(),
    notes: 'Si ya contrató, agendó o dijo que no, no se le insiste (y si compró, entra al CRM).',
  },
  crm(
    'Registrar Conversion',
    "{ accion: 'registrar_conversion', parametros: Object.assign({ telefono: $('Uno por Candidato').item.json.telefono, estado: $json.estado, detalle: $json.detalle }, $json.nombre ? { nombre_contacto: $json.nombre } : {}) }",
    [160, 2050],
  ),
  {
    parameters: {
      method: 'POST',
      url: `=${CW}/{{ $('Uno por Candidato').item.json.chatwoot_conversation_id }}/messages`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={{ (() => {
  const c = $('Leer Clasificacion').item.json;
  const d = $json.data || {};
  const texto = c.estado === 'rechazado'
    ? '🚫 Seguimiento: el cliente no quiere continuar (' + c.detalle + '). No se le insiste más.'
    : '✅ Seguimiento: este cliente ya ' + (c.estado === 'vendido' ? 'contrató' : 'agendó') + ' por chat (' + c.detalle + '). ' + (d.cliente_creado ? 'Lo agregué al CRM. ' : 'Ya estaba en el CRM. ') + (d.pedido_en_crm ? 'Ya tiene pedido en el CRM. ' : 'FALTA crear su pedido en el CRM para que quede registrado. ') + 'No se le hará más seguimiento.';
  return JSON.stringify({ content: texto, message_type: 'outgoing', private: true });
})() }}`,
      options: { timeout: 10000 },
    },
    name: 'Nota Conversion',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [400, 2050],
    id: crypto.randomUUID(),
    credentials: CRED_CW,
    onError: 'continueRegularOutput',
  },
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
  // Barrido del dueño: en esos chats una persona a cargo no frena el seguimiento.
  const persona = !$('Uno por Candidato').item.json.sin_filtro_persona && mensajes.some((m) => m.message_type === 1 && !m.private && m.sender && m.sender.type === 'user' && m.sender.name !== 'Byron ADMIN' && m.created_at > hace24h);
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
  'Sin Persona a Cargo?': main('Armar Transcripcion'),
  'Armar Transcripcion': main('Clasificar Conversion'),
  'Clasificar Conversion': main('Leer Clasificacion'),
  'Leer Clasificacion': main('Sigue Abierto?'),
  'Sigue Abierto?': {
    main: [
      [{ node: 'Redactar Seguimiento', type: 'main', index: 0 }],
      [{ node: 'Registrar Conversion', type: 'main', index: 0 }],
    ],
  },
  'Registrar Conversion': main('Nota Conversion'),
  'Redactar Seguimiento': main('Armar Seguimiento'),
  'Armar Seguimiento': main('Enviar Seguimiento'),
  'Enviar Seguimiento': main('Guardar Seguimiento en Memoria'),
  'Guardar Seguimiento en Memoria': main('Anotar Seguimiento'),
}

module.exports = { nodos, conexiones }
