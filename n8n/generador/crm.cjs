// Rama CRM: en cada turno registra cliente y conversación, como el CRM WEB de 321.
const crypto = require('node:crypto')
const CRM_URL = 'https://laundry-vip.vercel.app/api/webhook'
const CRED = { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } }

const jsCode = `// Arma lo que se registra en el CRM de Lavandería VIP en cada turno.
// El nombre del perfil de WhatsApp entra como provisional; el que diga el cliente lo reemplaza.
const wa = $('WhatsApp Inicio').first().json;
const ext = $('Extraer JSON').first().json;
const msg = $('Preparar Mensaje Final').first().json;

// Un operador de planta no es un lead: sus órdenes ya quedan en el CRM por sus tools.
let esOperador = false;
try { esOperador = $('Verificar Operador').first().json.data?.es_operador === true; } catch (e) {}
if (esOperador) return [];

const telefono = '+' + String(wa.contacts[0].wa_id || '').replace(/\\D/g, '');
const perfil = (wa.contacts[0].profile && wa.contacts[0].profile.name) || '';
const nombre = ext.lead_nombre && ext.lead_nombre !== perfil ? String(ext.lead_nombre) : '';
const tipo = ['clinica', 'restaurante', 'hotel'].includes(ext.metadata_tipo_lead) ? ext.metadata_tipo_lead : null;
const convId = Number(wa._chatwoot_conversation_id) || null;

const clienteParams = { telefono, canal_origen: 'whatsapp_agente' };
if (perfil) clienteParams.nombre_whatsapp = perfil;
if (nombre) clienteParams.nombre_contacto = nombre;
if (tipo) clienteParams.tipo_negocio = tipo;

const conversacionParams = {
  telefono,
  contexto: {
    nombre_whatsapp: perfil,
    temperatura: ext.metadata_temperatura || '',
    necesidad: ext.metadata_pain_point || '',
    proxima_accion: ext.metadata_next_action || '',
    ultimo_mensaje_cliente: String(msg.message_text || '').slice(0, 500),
    ultima_respuesta_agente: String(ext.texto_limpio || '').slice(0, 500),
    escalado: ext.escalar_humano === 'si',
    tool_consultada: ext.metadata_tool_consultada || null,
    chatwoot_url: convId ? 'https://chatwoot-production-8564.up.railway.app/app/accounts/3/conversations/' + convId : '',
  },
};
if (convId) conversacionParams.chatwoot_conversation_id = convId;

return [{ json: {
  cliente: { accion: 'find_or_create_client', parametros: clienteParams },
  conversacion: { accion: 'sincronizar_memoria_conversacion', parametros: conversacionParams },
} }];`

const http = (name, cuerpo, position) => ({
  parameters: {
    method: 'POST',
    url: CRM_URL,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify(${cuerpo}) }}`,
    options: { timeout: 15000 },
  },
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  id: crypto.randomUUID(),
  credentials: CRED,
  onError: 'continueRegularOutput',
})

const nodos = [
  {
    parameters: { jsCode },
    name: 'Preparar CRM Body',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2960, 640],
    id: crypto.randomUUID(),
    onError: 'continueRegularOutput',
  },
  http('Registrar Cliente CRM', "$('Preparar CRM Body').first().json.cliente", [3200, 640]),
  http(
    'Registrar Conversacion CRM',
    "$('Preparar CRM Body').first().json.conversacion",
    [3440, 640],
  ),
]
const main = (d) => ({ main: [[{ node: d, type: 'main', index: 0 }]] })
const conexiones = {
  'Preparar CRM Body': main('Registrar Cliente CRM'),
  'Registrar Cliente CRM': main('Registrar Conversacion CRM'),
}
module.exports = { nodos, conexiones }
