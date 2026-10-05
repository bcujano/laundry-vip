// Seguimiento · detección de conversión: antes de insistir se lee la conversación y se
// decide si ya compró, agendó o dijo que no (si compró, entra al CRM).
const { ES_AGENTE_JS } = require('./agente.cjs')
const { crypto, CW, CRED_CW, CRED_OPENAI, crm, main } = require('./seguimiento-comun.cjs')

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
${ES_AGENTE_JS}
const msgs = (($('Mensajes Seguimiento').item.json.payload) || []).slice(-40);
const lineas = msgs
  .filter((m) => String(m.content || '').trim() !== '')
  // Las notas que deja este mismo sistema (borradores, avisos) no son conversación.
  .filter((m) => !(m.private && esAgente(m)))
  .map((m) => {
    let quien;
    if (m.message_type === 0) quien = 'CLIENTE';
    else if (m.private) quien = 'NOTA INTERNA';
    else if (esAgente(m)) quien = 'AGENTE';
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
]

const conexiones = {
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
}

module.exports = { nodos, conexiones }
