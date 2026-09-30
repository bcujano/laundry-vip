// Protecciones del CRM que n8n debe activar (CONTINUIDAD §4, B2):
//  - tope diario de mensajes por teléfono y deduplicación: UNA llamada a
//    `registrar_evento_entrante` por mensaje (tras el debounce), con el teléfono
//    en el sobre. Contar en las tools contaría llamadas, no mensajes.
//  - tope de gasto de OpenAI: al terminar el turno se reporta un costo ESTIMADO
//    (esta versión de n8n no expone los tokens del agente).
const crypto = require('node:crypto')
const CRM_URL = 'https://laundry-vip.vercel.app/api/webhook'
const CRED_CRM = { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } }
const CRED_CW = { httpHeaderAuth: { id: '3W2BykSid0f9dMTV', name: 'Chatwoot Laundry VIP API' } }

const ID_MENSAJE = "String($('WhatsApp Inicio').item.json._chatwoot_message_id)"

// Teléfono E.164 del que escribe; si no se puede armar, el sobre va sin él (el
// servidor no cuenta) y el flujo sigue: una protección caída no apaga al agente.
const TELEFONO = `(() => { const d = String($('WhatsApp Inicio').item.json.contacts[0].wa_id || '').replace(/\\D/g, ''); return /^[1-9]\\d{7,14}$/.test(d) ? '+' + d : undefined })()`

const cuerpoEntrante = `{
  accion: 'registrar_evento_entrante',
  telefono: ${TELEFONO},
  parametros: { dedupe_key: 'chatwoot-' + ${ID_MENSAJE}, tipo: 'message_created' },
}`

const cuerpoUso = `{
  accion: 'registrar_evento_entrante',
  parametros: {
    dedupe_key: 'uso-' + ${ID_MENSAJE},
    tipo: 'uso_openai',
    uso_openai: { tokens: $json.tokens, costo_estimado_usd: $json.costo_estimado_usd },
  },
}`

const PUEDE_CONTINUAR = `={{ (() => {
  const j = $json;
  if (j.ok === true) return j.data.ya_procesado !== true && j.data.costo_excedido !== true;
  // Solo el tope diario corta; cualquier otro fallo del CRM deja pasar al cliente.
  return !(j.error && j.error.code === 'LIMITE_DIARIO_ALCANZADO');
})() }}`

const motivoDeCorte = `// Por qué no se atiende este mensaje. Un mensaje repetido se descarta en silencio.
const j = $input.first().json;
if (j.ok === true && j.data.ya_procesado === true) return [];
const limite = !(j.ok === true);
return [{ json: limite
  ? { privado: true, texto: '🚦 Este número llegó al tope diario de mensajes: el agente no le contesta más hoy. Revise la conversación y atiéndalo a mano si hace falta.' }
  : { privado: false, texto: 'Hoy ya no puedo seguir atendiendo por este medio. Mañana con gusto le sigo ayudando; si es urgente, puede llamarnos por teléfono.' } }];`

// Costo estimado del turno. Cada llamada del agente (la inicial + una por tool)
// reenvía prompt + historial; las cifras son de gpt-4.1-mini ($0,40 / $1,60 por
// millón de tokens). Se reporta por encima de lo real a propósito: el tope es
// una red de seguridad, no contabilidad.
const estimarUso = `let agente = null;
for (const n of ['Agente Laundry VIP', 'Agente Operador']) {
  try { agente = { nombre: n, json: $(n).first().json }; break; } catch (e) {}
}
if (!agente) return [];
const pasos = Array.isArray(agente.json.intermediateSteps) ? agente.json.intermediateSteps : [];
const promptCaracteres = agente.nombre === 'Agente Operador' ? 10000 : 19500;
const entrada = String($('Preparar Mensaje Final').first().json.message_text || '').length;
const observaciones = pasos.reduce((s, p) => s + String((p && p.observation) || '').length, 0);
const salida = String(agente.json.output || '').length;
const llamadas = 1 + pasos.length;
const tokensEntrada = Math.ceil(llamadas * (promptCaracteres + entrada + 4000) / 4) + Math.ceil(observaciones / 4);
const tokensSalida = Math.ceil((salida + pasos.length * 200) / 4);
const costo = tokensEntrada * 0.4e-6 + tokensSalida * 1.6e-6;
return [{ json: { tokens: tokensEntrada + tokensSalida, costo_estimado_usd: Number(costo.toFixed(5)) } }];`

const code = (name, jsCode, position) => ({
  parameters: { jsCode },
  name,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
  id: crypto.randomUUID(),
  onError: 'continueRegularOutput',
})

const http = (name, cuerpo, position, extra = {}) => ({
  parameters: {
    method: 'POST',
    url: CRM_URL,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify(${cuerpo}) }}`,
    // neverError: el 429 del tope llega como cuerpo y no como fallo del nodo.
    options: { timeout: 15000, response: { response: { neverError: true } } },
  },
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  id: crypto.randomUUID(),
  credentials: CRED_CRM,
  onError: 'continueRegularOutput',
  ...extra,
})

const nodos = [
  http('Registrar Entrante', cuerpoEntrante, [-96, 384]),
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'puede-continuar',
            leftValue: PUEDE_CONTINUAR,
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: 'Puede Continuar?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [128, 384],
    id: crypto.randomUUID(),
  },
  code('Motivo de Corte', motivoDeCorte, [352, 560]),
  {
    parameters: {
      method: 'POST',
      url: "=https://chatwoot-production-8564.up.railway.app/api/v1/accounts/3/conversations/{{ $('WhatsApp Inicio').item.json._chatwoot_conversation_id }}/messages",
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody:
        '={{ JSON.stringify({ content: $json.texto, message_type: "outgoing", private: $json.privado }) }}',
      options: { timeout: 5000 },
    },
    name: 'Aviso de Corte',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [576, 560],
    id: crypto.randomUUID(),
    credentials: CRED_CW,
    onError: 'continueRegularOutput',
  },
  code('Estimar Uso', estimarUso, [2960, 880]),
  http('Registrar Uso', cuerpoUso, [3200, 880]),
]

const main = (...d) => ({ main: [d.map((node) => ({ node, type: 'main', index: 0 }))] })
const conexiones = {
  'Es Ultimo Mensaje?': main('Registrar Entrante'),
  'Registrar Entrante': main('Puede Continuar?'),
  'Puede Continuar?': {
    main: [
      [{ node: 'Combinar Textos', type: 'main', index: 0 }],
      [{ node: 'Motivo de Corte', type: 'main', index: 0 }],
    ],
  },
  'Motivo de Corte': main('Aviso de Corte'),
  'Estimar Uso': main('Registrar Uso'),
}

module.exports = { nodos, conexiones }
