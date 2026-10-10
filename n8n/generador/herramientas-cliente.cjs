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
      'Cotiza prendas contra el catálogo real y devuelve precio y plazo de entrega. Úsala SIEMPRE antes de decir cualquier precio o plazo.',
      `{"prendas": ${fromAI('prendas', 'Las prendas del cliente, una por línea, con el formato cantidad y nombre (sin escribir la unidad: libras, piezas). Si el cliente ya eligió el método de lavado, agrega al final de esa línea | agua, | seco, | planchado o | unico; si no lo eligió, no lo pongas.')}}`,
    ],
    [
      'obtener_proxima_ventana',
      'Devuelve la ventana de recoleccion (inicio y fin en UTC ISO), el horario del local, la tarifa de recogida y entrega y los plazos habituales de entrega por metodo (plazos_por_metodo). Si el cliente pide OTRO DIA, vuelve a llamarla con desde = esa fecha. Usala antes de hablar de horarios, fechas, tarifa o tiempos.',
      `{"desde": ${fromAI('desde', 'Fecha desde la que buscar la ventana, formato YYYY-MM-DD. Cadena vacia para la proxima disponible. Si el cliente dice "manana", manda la fecha de manana.')}}`,
    ],
    [
      'verificar_cobertura',
      'Dice si se recoge en el barrio o sector que nombró el cliente. Llámala apenas lo diga. Devuelve cubre: true (sí se recoge), false (no se recoge) o null (no se puede verificar).',
      `{"sector": ${fromAI('sector', 'Barrio o sector que dijo el cliente, tal como lo escribió', 'string')}, "direccion": ${fromAI('direccion', 'Dirección completa si el cliente ya la dio; cadena vacía si no', 'string')}}`,
    ],
    [
      'find_or_create_client',
      'Busca o registra al cliente por su teléfono. Devuelve cliente.id y si hay que enviar el aviso de privacidad.',
      `{"telefono": "${telefono}", "canal_origen": "whatsapp_agente", "nombre_contacto": ${fromAI('nombre_contacto', 'Nombre de la persona de contacto')}, "nombre_negocio": ${fromAI('nombre_negocio', 'Nombre del negocio; cadena vacía si es particular')}, "tipo_negocio": ${fromAI('tipo_negocio', 'Uno de: clinica, restaurante, hotel, otro, particular')}}`,
    ],
    [
      'crear_pedido',
      'Crea el pedido. SOLO después de que el cliente confirmó el resumen con un sí explícito.',
      `{"canal": "whatsapp_agente", "cliente_id": ${fromAI('cliente_id', 'uuid completo que devolvió find_or_create_client')}, "tipo_entrega": ${fromAI('tipo_entrega', 'combo si la lavandería recoge y entrega con la tarifa única; a_la_carta si el cliente trae y retira su ropa')}, "prendas": ${fromAI('prendas', 'Las prendas del pedido, una por línea, con el mismo formato de cotizar_prendas y con el método ya elegido')}, "direccion_recoleccion": ${fromAI('direccion_recoleccion', 'Dirección completa de la recogida; cadena vacía si el cliente trae su ropa')}, "sector": ${fromAI('sector', 'Barrio o sector de la recogida tal como lo dijo el cliente; cadena vacía si no aplica')}, "ventana_recoleccion_inicio": ${fromAI('ventana_recoleccion_inicio', 'Inicio de la ventana en ISO, tal como vino de obtener_proxima_ventana; cadena vacía si el cliente trae su ropa')}, "ventana_recoleccion_fin": ${fromAI('ventana_recoleccion_fin', 'Fin de la ventana en ISO, tal como vino de obtener_proxima_ventana; cadena vacía si el cliente trae su ropa')}}`,
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
