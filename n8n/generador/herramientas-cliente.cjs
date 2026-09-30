// Las 6 tools del agente de clientes: HTTP Request Tool contra /api/webhook del CRM.
const crypto = require('node:crypto')

const CRM_URL = 'https://laundry-vip.vercel.app/api/webhook'
const CRED_CRM = { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } }
const CRED = { crm: CRED_CRM }

function agregar(nodes) {
  const telefono = "+{{ $('WhatsApp Inicio').first().json.contacts[0].wa_id }}"
  const fromAI = (clave, desc, tipo = 'string') =>
    `{{ JSON.stringify($fromAI('${clave}', '${desc}', '${tipo}')) }} `
  const TOOLS = [
    [
      'cotizar_prendas',
      'Cotiza prendas contra el catálogo real. Úsala SIEMPRE antes de decir cualquier precio.',
      `{"items": ${fromAI('items', 'Array JSON de prendas: [{"descripcion":"camiseta","cantidad":5,"metodo":"agua"}]. metodo es opcional: unico, agua, seco o planchado. Solo inclúyelo si el cliente ya lo eligió.', 'json')}}`,
    ],
    [
      'obtener_proxima_ventana',
      'Devuelve la ventana de recoleccion (inicio y fin en UTC ISO), el horario del local, la tarifa de recogida y entrega, hasta donde se recoge y el lapso de entrega en horas. Si el cliente pide OTRO DIA, vuelve a llamarla con desde = esa fecha. Usala antes de hablar de horarios, fechas, tarifa, cobertura o tiempos.',
      `{"desde": ${fromAI('desde', 'Fecha desde la que buscar la ventana, formato YYYY-MM-DD. Cadena vacia para la proxima disponible. Si el cliente dice "manana", manda la fecha de manana.')}}`,
    ],
    [
      'calcular_vehiculo',
      'Dice si la recolección va en moto o auto según el número de fundas.',
      `{"numero_fundas": ${fromAI('numero_fundas', 'Número entero de fundas que entregará el cliente', 'number')}}`,
    ],
    [
      'find_or_create_client',
      'Busca o registra al cliente por su teléfono. Devuelve cliente.id y si hay que enviar el aviso de privacidad.',
      `{"telefono": "${telefono}", "canal_origen": "whatsapp_agente", "nombre_contacto": ${fromAI('nombre_contacto', 'Nombre de la persona de contacto')}, "nombre_negocio": ${fromAI('nombre_negocio', 'Nombre del negocio; cadena vacía si es particular')}, "tipo_negocio": ${fromAI('tipo_negocio', 'Uno de: clinica, restaurante, hotel, otro, particular')}}`,
    ],
    [
      'crear_pedido',
      'Crea el pedido. SOLO después de que el cliente confirmó el resumen con un sí explícito.',
      `={{ JSON.stringify(Object.assign({canal: 'whatsapp_agente'}, $fromAI('pedido', 'Objeto JSON con: cliente_id (uuid de find_or_create_client), tipo_entrega ("combo" si la lavanderia recoge y entrega con la tarifa unica, "a_la_carta" si el cliente trae y retira su ropa), items (como en cotizar_prendas, con metodo ya elegido), numero_fundas, direccion_recoleccion, sector (barrio o sector de la recogida, como lo dijo el cliente), ventana_recoleccion_inicio y ventana_recoleccion_fin (ISO tal como vinieron), y si el cliente trae y retira, metodo_transporte_recoleccion y metodo_transporte_entrega en "propio_cliente".', 'json'))) }}`,
    ],
    [
      'consultar_estado_pedido',
      'Devuelve el estado del pedido más reciente de este cliente.',
      `{"telefono": "${telefono}"}`,
    ],
  ]
  TOOLS.forEach(([nombre, descripcion, parametros], i) => {
    const jsonBody = parametros.startsWith('={{')
      ? `={"accion":"${nombre}","parametros": {{ ${parametros.slice(4, -3).trim()} }} }`
      : `={"accion":"${nombre}","parametros": ${parametros}}`
    nodes.push({
      parameters: {
        toolDescription: descripcion,
        method: 'POST',
        url: CRM_URL,
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody,
        options: { response: { response: { neverError: true } }, timeout: 20000 },
      },
      name: nombre,
      type: 'n8n-nodes-base.httpRequestTool',
      typeVersion: 4.2,
      position: [1500 + i * 180, 752],
      id: crypto.randomUUID(),
      credentials: CRED.crm,
    })
  })
  return TOOLS
}

module.exports = { agregar }
