// Resumen diario 8:00 para los admins.
// Dentro de las 24 h desde su último mensaje, Meta deja mandar texto libre; fuera
// de esa ventana solo una plantilla aprobada (resumen_diario_admin). El CRM
// anota cuándo escribió cada número autorizado y dice cuál de los dos va.
const crypto = require('node:crypto')
const CRM_URL = 'https://laundry-vip.vercel.app/api/webhook'
const CRED_CRM = { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } }
const CRED_META = { httpHeaderAuth: { id: 'baJJfX3zWMindSEN', name: 'Meta WhatsApp Laundry VIP' } }
const GRAPH = 'https://graph.facebook.com/v22.0/1220603671147410/messages'

const jsCode = `// Un mensaje por administrador: texto libre y, por si está fuera de las 24 h,
// los 7 datos que pide la plantilla.
const r = $input.first().json.data || {};
const dinero = (n) => '$' + Number(n || 0).toFixed(2).replace('.', ',');
return (r.admins || []).map((admin) => {
  const nombre = String(admin.nombre || 'equipo').split(' ')[0];
  const ventas = dinero(r.ventas_verificadas_ayer) + ' en ' + (r.pedidos_ayer || 0) + ' pedidos';
  return {
    json: {
      telefono: String(admin.telefono || '').replace(/\\D/g, ''),
      dentro_de_ventana: admin.dentro_de_ventana === true,
      texto: [
        'Buenos días, ' + nombre + '. Resumen de hoy, ' + (r.fecha || '') + ':',
        '• Ventas verificadas ayer: ' + ventas,
        '• Recolecciones hoy: ' + (r.recolecciones_hoy || 0),
        '• Discrepancias abiertas: ' + (r.discrepancias_abiertas || 0),
        '• Pagos pendientes: ' + (r.pagos_pendientes || 0),
        '• Recolectados sin contar: ' + (r.sin_contar_en_planta || 0),
        '• Leads calientes sin pedido: ' + (r.leads_calientes_sin_pedido || 0),
        'Detalle en el CRM: https://laundry-vip.vercel.app',
      ].join('\\n'),
      parametros: [
        nombre,
        r.fecha || '',
        ventas,
        String(r.recolecciones_hoy || 0),
        String(r.discrepancias_abiertas || 0),
        String(r.pagos_pendientes || 0),
        String(r.leads_calientes_sin_pedido || 0),
      ],
    },
  };
});`

const http = (name, jsonBody, credentials, position, extra = {}) => ({
  parameters: {
    method: 'POST',
    url: jsonBody.includes('resumen_diario"') ? CRM_URL : GRAPH,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody,
    options: { timeout: 30000 },
  },
  name,
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position,
  id: crypto.randomUUID(),
  credentials,
  ...extra,
})

const nodos = [
  {
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * 1-6' }] } },
    name: 'Resumen 8:00',
    type: 'n8n-nodes-base.scheduleTrigger',
    typeVersion: 1.2,
    position: [-2000, 1200],
    id: crypto.randomUUID(),
    notes: 'Lunes a sábado 8:00 (zona del workflow: America/Guayaquil).',
  },
  http('Datos Resumen CRM', '{"accion":"resumen_diario","parametros":{}}', CRED_CRM, [-1760, 1200]),
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
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'dentro-24h',
            leftValue: '={{ $json.dentro_de_ventana === true }}',
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      looseTypeValidation: true,
      options: {},
    },
    name: '¿Dentro de 24 h?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [-1280, 1200],
    id: crypto.randomUUID(),
  },
  http(
    'Enviar Resumen WhatsApp',
    '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.telefono, type: "text", text: { body: $json.texto } }) }}',
    CRED_META,
    [-1040, 1100],
    { onError: 'continueRegularOutput' },
  ),
  http(
    'Enviar Resumen Plantilla',
    '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.telefono, type: "template", template: { name: "resumen_diario_admin", language: { code: "es" }, components: [{ type: "body", parameters: $json.parametros.map((t) => ({ type: "text", text: t })) }] } }) }}',
    CRED_META,
    [-1040, 1300],
    {
      onError: 'continueRegularOutput',
      notes: 'Solo funciona cuando Meta apruebe la plantilla resumen_diario_admin.',
    },
  ),
]

const main = (d) => ({ main: [[{ node: d, type: 'main', index: 0 }]] })
const conexiones = {
  'Resumen 8:00': main('Datos Resumen CRM'),
  'Datos Resumen CRM': main('Un Mensaje por Admin'),
  'Un Mensaje por Admin': main('¿Dentro de 24 h?'),
  '¿Dentro de 24 h?': {
    main: [
      [{ node: 'Enviar Resumen WhatsApp', type: 'main', index: 0 }],
      [{ node: 'Enviar Resumen Plantilla', type: 'main', index: 0 }],
    ],
  },
}

module.exports = { nodos, conexiones }
