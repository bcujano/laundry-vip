// Resumen diario 8:00 para los admins. Meta exige plantilla aprobada para escribir primero:
// el disparador queda APAGADO hasta que la plantilla resumen_diario_admin esté aprobada.
const crypto = require('node:crypto')
const CRM_URL = 'https://laundry-vip.vercel.app/api/webhook'
const CRED_CRM = { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } }
const CRED_META = { httpHeaderAuth: { id: 'baJJfX3zWMindSEN', name: 'Meta WhatsApp Laundry VIP' } }
const PHONE_ID = '1220603671147410'

const jsCode = `// Un mensaje por administrador, con los 7 datos que pide la plantilla.
const r = $input.first().json.data || {};
const dinero = (n) => '$' + Number(n || 0).toFixed(2).replace('.', ',');
return (r.admins || []).map((admin) => ({
  json: {
    telefono: String(admin.telefono || '').replace(/\\D/g, ''),
    parametros: [
      String(admin.nombre || 'equipo').split(' ')[0],
      r.fecha || '',
      dinero(r.ventas_verificadas_ayer) + ' en ' + (r.pedidos_ayer || 0) + ' pedidos',
      String(r.recolecciones_hoy || 0),
      String(r.discrepancias_abiertas || 0),
      String(r.pagos_pendientes || 0),
      String(r.leads_calientes_sin_pedido || 0),
    ],
  },
}));`

const nodos = [
  {
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * 1-6' }] } },
    name: 'Resumen 8:00',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [-2000, 1200],
    id: crypto.randomUUID(),
    disabled: true,
    notes: 'Encender cuando Meta apruebe la plantilla resumen_diario_admin.',
  },
  {
    parameters: {
      method: 'POST',
      url: CRM_URL,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '{"accion":"resumen_diario","parametros":{}}',
      options: { timeout: 30000 },
    },
    name: 'Datos Resumen CRM',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [-1760, 1200],
    id: crypto.randomUUID(),
    credentials: CRED_CRM,
  },
  {
    parameters: { jsCode },
    name: 'Un Mensaje por Admin',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [-1520, 1200],
    id: crypto.randomUUID(),
  },
  {
    parameters: {
      method: 'POST',
      url: `https://graph.facebook.com/v22.0/${PHONE_ID}/messages`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody:
        '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.telefono, type: "template", template: { name: "resumen_diario_admin", language: { code: "es" }, components: [{ type: "body", parameters: $json.parametros.map((t) => ({ type: "text", text: t })) }] } }) }}',
      options: { timeout: 15000 },
    },
    name: 'Enviar Resumen WhatsApp',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [-1280, 1200],
    id: crypto.randomUUID(),
    credentials: CRED_META,
    onError: 'continueRegularOutput',
  },
]

const main = (d) => ({ main: [[{ node: d, type: 'main', index: 0 }]] })
const conexiones = {
  'Resumen 8:00': main('Datos Resumen CRM'),
  'Datos Resumen CRM': main('Un Mensaje por Admin'),
  'Un Mensaje por Admin': main('Enviar Resumen WhatsApp'),
}

module.exports = { nodos, conexiones }
