// Aviso inmediato del agente al equipo (cuestionario de María Sol, 2026-10): cuando el agente
// escala un caso, el equipo recibe un WhatsApp a cualquier hora; si nadie lo atiende en 30
// minutos hábiles se repite UNA vez. El texto, el plazo y el reintento los decide el servidor
// (acciones crear_aviso_equipo / avisos_equipo_pendientes / marcar_aviso_equipo): aquí solo
// se crea el aviso, se entrega y se marca.
//
//  Crear:   Nota Escalamiento → Crear Aviso Equipo
//  Atender: Respondio Persona? → Atender Avisos Equipo (una persona escribió: se acabó el aviso)
//  Enviar:  cada 3 min, 24/7 → Avisos Equipo Pendientes ─┬→ Uno por Destinatario → ¿en ventana?
//                                                          │     sí: texto libre · no: plantilla `aviso_equipo`
//                                                          └→ Uno por Aviso Equipo → Marcar Aviso Equipo
//
// La plantilla de Meta `aviso_equipo` (categoría UTILITY, es) la crea el dueño en Meta Business:
//   «Aviso del agente: {{1}}. Cliente: {{2}}. Detalle: {{3}}. Atienda aquí: {{4}}. Gracias.»
// Mientras no esté aprobada, el aviso llega por WhatsApp solo a quien escribió al agente en las
// últimas 24 h; el resto queda en la nota interna de Chatwoot (que el agente siempre deja).
const { crypto, CRED_META, GRAPH, crm, main } = require('./seguimiento-comun.cjs')

const unoPorDestinatario = `// Un mensaje por aviso y por persona del equipo.
const r = $input.first().json || {};
const d = r.data || {};
const out = [];
for (const a of d.avisos || []) {
  for (const p of d.destinatarios || []) {
    out.push({ json: { aviso_id: a.id, texto: a.texto, parametros: a.parametros, telefono: p.telefono, dentro_de_ventana: p.dentro_de_ventana } });
  }
}
return out;`

const unoPorAviso = `// Un elemento por aviso, para marcarlo una vez entregado.
const d = ($input.first().json || {}).data || {};
return (d.avisos || []).map((a) => ({ json: { id: a.id, estado: a.reintento ? 'reintentado' : 'enviado' } }));`

const nodos = [
  crm(
    'Crear Aviso Equipo',
    "{ accion: 'crear_aviso_equipo', parametros: { tipo: 'escalada', caso: 'chat-' + $('WhatsApp Inicio').item.json._chatwoot_conversation_id, chatwoot_conversation_id: Number($('WhatsApp Inicio').item.json._chatwoot_conversation_id) || undefined, telefono_cliente: '+' + $('WhatsApp Inicio').item.json.contacts[0].wa_id, resumen: String('El cliente dijo: ' + ($('Preparar Mensaje Final').item.json.message_text || '') + ' · Necesidad: ' + ($('Extraer JSON').first().json.metadata_pain_point || 'sin dato')).slice(0, 580) } }",
    [3680, 80],
  ),
  crm(
    'Atender Avisos Equipo',
    "{ accion: 'atender_avisos_equipo', parametros: { chatwoot_conversation_id: Number($('Chatwoot Webhook').item.json.body.conversation.id) } }",
    [-1552, 360],
  ),
  {
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '*/3 * * * *' }] } },
    name: 'Avisos Equipo cada 3 min',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [-2000, 2800],
    id: crypto.randomUUID(),
    notes:
      'Todos los días, a cualquier hora (zona America/Guayaquil): los avisos al equipo no esperan al horario.',
  },
  crm(
    'Avisos Equipo Pendientes',
    "{ accion: 'avisos_equipo_pendientes', parametros: {} }",
    [-1760, 2800],
  ),
  {
    parameters: { jsCode: unoPorDestinatario },
    name: 'Uno por Destinatario',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-1520, 2700],
    id: crypto.randomUUID(),
  },
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'destinatario-en-ventana',
            leftValue: '={{ $json.dentro_de_ventana === true }}',
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: 'Destinatario en Ventana?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [-1280, 2700],
    id: crypto.randomUUID(),
    notes:
      'Con ventana abierta (escribió al agente en 24 h): texto libre. Si no: plantilla aprobada.',
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
    name: 'Aviso Equipo Texto',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [-1040, 2600],
    id: crypto.randomUUID(),
    credentials: CRED_META,
    onError: 'continueRegularOutput',
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
        '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.telefono, type: "template", template: { name: "aviso_equipo", language: { code: "es" }, components: [{ type: "body", parameters: $json.parametros.map((t) => ({ type: "text", text: t })) }] } }) }}',
      options: { timeout: 30000 },
    },
    name: 'Aviso Equipo Plantilla',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [-1040, 2800],
    id: crypto.randomUUID(),
    credentials: CRED_META,
    onError: 'continueRegularOutput',
    notes:
      'Falla hasta que Meta apruebe la plantilla aviso_equipo; el aviso igual queda en la nota interna.',
  },
  {
    parameters: { jsCode: unoPorAviso },
    name: 'Uno por Aviso Equipo',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-1520, 2900],
    id: crypto.randomUUID(),
  },
  crm(
    'Marcar Aviso Equipo',
    "{ accion: 'marcar_aviso_equipo', parametros: { id: $json.id, estado: $json.estado } }",
    [-1280, 2900],
  ),
]

const conexiones = {
  'Nota Escalamiento': main('Crear Aviso Equipo'),
  'Respondio Persona?': {
    main: [
      [
        { node: 'Etiqueta Humano Persona', type: 'main', index: 0 },
        { node: 'Atender Avisos Equipo', type: 'main', index: 0 },
      ],
    ],
  },
  'Avisos Equipo cada 3 min': main('Avisos Equipo Pendientes'),
  'Avisos Equipo Pendientes': {
    main: [
      [
        { node: 'Uno por Destinatario', type: 'main', index: 0 },
        { node: 'Uno por Aviso Equipo', type: 'main', index: 0 },
      ],
    ],
  },
  'Uno por Destinatario': main('Destinatario en Ventana?'),
  'Destinatario en Ventana?': {
    main: [
      [{ node: 'Aviso Equipo Texto', type: 'main', index: 0 }],
      [{ node: 'Aviso Equipo Plantilla', type: 'main', index: 0 }],
    ],
  },
  'Uno por Aviso Equipo': main('Marcar Aviso Equipo'),
}

module.exports = { nodos, conexiones }
