// Modo operador: números de la lista blanca registran órdenes presenciales por WhatsApp.
const crypto = require('node:crypto')
const fs = require('node:fs')
const CRM_URL = 'https://laundry-vip.vercel.app/api/webhook'
const CRED_CRM = { httpHeaderAuth: { id: '9456EHfb8yxpZOmr', name: 'CRM Laundry VIP Webhook' } }
const OP = "+{{ $('WhatsApp Inicio').first().json.contacts[0].wa_id }}"
const fromAI = (clave, desc, tipo = 'string') =>
  `{{ JSON.stringify($fromAI('${clave}', '${desc}', '${tipo}')) }} `
const ITEMS =
  'Array JSON de prendas: [{"descripcion":"camisa","cantidad":6,"metodo":"agua"}]. metodo opcional: unico, agua, seco o planchado.'

const TOOLS = [
  [
    'cotizar_prendas_operador',
    'cotizar_prendas',
    'Resuelve prendas, métodos y precios contra el catálogo. Úsala antes de registrar una orden.',
    `{"items": ${fromAI('items', ITEMS, 'json')}}`,
  ],
  [
    'registrar_cliente_presencial',
    'registrar_cliente_presencial',
    'Registra una ORDEN presencial: crea o reutiliza el cliente por teléfono y guarda sus prendas. Devuelve pedido_id y monto estimado.',
    `{"telefono_operador": "${OP}", "telefono_cliente": ${fromAI('telefono_cliente', 'Teléfono del cliente en formato +593XXXXXXXXX')}, "nombre_contacto": ${fromAI('nombre_contacto', 'Nombre del cliente')}, "nombre_negocio": ${fromAI('nombre_negocio', 'Nombre del negocio o cadena vacía')}, "items": ${fromAI('items', ITEMS, 'json')}}`,
  ],
  [
    'actualizar_registro',
    'actualizar_registro',
    'Corrige la última orden registrada (o la del pedido_id): reemplaza la lista completa de prendas y/o completa nombres. Nunca crea una orden nueva.',
    "={{ JSON.stringify(Object.assign({telefono_operador: '+' + $('WhatsApp Inicio').first().json.contacts[0].wa_id}, $fromAI('correccion', 'Objeto JSON con lo que cambia: pedido_id (opcional, uuid), items (lista COMPLETA corregida, opcional), nombre_contacto, nombre_negocio (opcionales).', 'json'))) }}",
  ],
  [
    'consultar_pedido',
    'consultar_pedido',
    'Detalle de una orden por su pedido_id completo.',
    `{"pedido_id": ${fromAI('pedido_id', 'uuid completo del pedido')}}`,
  ],
  [
    'buscar_pedidos',
    'buscar_pedidos',
    'Encuentra las órdenes abiertas de un cliente por nombre, negocio o teléfono. Úsala cuando no tengas el pedido_id.',
    `{"telefono_operador": "${OP}", "texto": ${fromAI('texto', 'Nombre, negocio o teléfono del cliente')}}`,
  ],
  [
    'avanzar_estado',
    'avanzar_estado',
    'Mueve una orden a recolectado, en_proceso, listo_para_entrega o entregado. Sin pedido_id usa la última orden que tocaste.',
    "={{ JSON.stringify(Object.assign({telefono_operador: '+' + $('WhatsApp Inicio').first().json.contacts[0].wa_id}, $fromAI('avance', 'Objeto JSON con estado (recolectado, en_proceso, listo_para_entrega o entregado) y pedido_id opcional (uuid).', 'json'))) }}",
  ],
  [
    'registrar_conteo',
    'registrar_conteo',
    'Registra lo que se contó en planta, TODAS las prendas de la orden. Si no cuadra, la orden se congela y se resuelve en el CRM.',
    "={{ JSON.stringify(Object.assign({telefono_operador: '+' + $('WhatsApp Inicio').first().json.contacts[0].wa_id}, $fromAI('conteo', 'Objeto JSON con conteos: [{descripcion, cantidad}] de TODAS las prendas, y pedido_id opcional (uuid).', 'json'))) }}",
  ],
  [
    'consulta_admin',
    'consulta_admin',
    'SOLO ADMIN. Lectura del negocio: como_vamos (mes contra mes, prendas que mas facturan, conversion de leads y recurrencia), resumen (el dia), atencion (lo que esta trabado), cola_manana, leads_calientes o clientes_top.',
    `{"telefono_operador": "${OP}", "consulta": ${fromAI('consulta', 'Una de: como_vamos, resumen, atencion, cola_manana, leads_calientes, clientes_top')}}`,
  ],
  [
    'generar_reporte',
    'generar_reporte',
    'SOLO ADMIN. Pedidos y montos entre dos fechas.',
    `{"telefono_operador": "${OP}", "desde": ${fromAI('desde', 'Fecha inicial YYYY-MM-DD')}, "hasta": ${fromAI('hasta', 'Fecha final YYYY-MM-DD')}}`,
  ],
]

function aplicar({ nodes, connections, nodo, REPO }) {
  // 1. ¿Quién escribe? La lista blanca vive en el CRM.
  nodes.push({
    parameters: {
      method: 'POST',
      url: CRM_URL,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={"accion":"verificar_whitelist_operador","parametros":{"telefono":"${OP}"}}`,
      options: { timeout: 10000 },
    },
    name: 'Verificar Operador',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1640, 288],
    id: crypto.randomUUID(),
    credentials: CRED_CRM,
    onError: 'continueRegularOutput',
  })
  nodes.push({
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'es-operador',
            leftValue: '={{ $json.data?.es_operador === true }}',
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      looseTypeValidation: true,
      options: {},
    },
    name: '¿Es Operador?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [1860, 288],
    id: crypto.randomUUID(),
  })

  // 2. Agente de planta: mismo nodo que el de clientes, otra constitución, memoria aparte.
  const base = nodo('Agente Laundry VIP')
  const prompt = fs
    .readFileSync(`${REPO}/n8n/prompt-operador-laundry.md`, 'utf8')
    .replace(/\n$/, '')
  nodes.push({
    ...structuredClone(base),
    name: 'Agente Operador',
    id: crypto.randomUUID(),
    position: [2256, -120],
    parameters: {
      ...structuredClone(base.parameters),
      options: { ...base.parameters.options, systemMessage: prompt },
    },
  })
  nodes.push({
    ...structuredClone(nodo('OpenAI Laundry')),
    name: 'OpenAI Operador',
    id: crypto.randomUUID(),
    position: [2060, 60],
  })
  const memoria = structuredClone(nodo('Memory Laundry'))
  memoria.parameters.sessionKey = "=operador_{{ $('WhatsApp Inicio').item.json.contacts[0].wa_id }}"
  nodes.push({ ...memoria, name: 'Memory Operador', id: crypto.randomUUID(), position: [2200, 60] })

  TOOLS.forEach(([nombre, accion, descripcion, parametros], i) => {
    const jsonBody = parametros.startsWith('={{')
      ? `={"accion":"${accion}","parametros": {{ ${parametros.slice(4, -3).trim()} }} }`
      : `={"accion":"${accion}","parametros": ${parametros}}`
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
      position: [2360 + i * 170, -300],
      id: crypto.randomUUID(),
      credentials: CRED_CRM,
    })
    connections[nombre] = { ai_tool: [[{ node: 'Agente Operador', type: 'ai_tool', index: 0 }]] }
  })

  // 3. Recableado: Typing → Verificar → IF → (operador | cliente) → mismo parser.
  const main = (d) => [{ node: d, type: 'main', index: 0 }]
  connections['Typing Indicator'] = { main: [main('Verificar Operador')] }
  connections['Verificar Operador'] = { main: [main('¿Es Operador?')] }
  connections['¿Es Operador?'] = { main: [main('Agente Operador'), main('Agente Laundry VIP')] }
  connections['Agente Operador'] = { main: [main('Extraer JSON')] }
  connections['OpenAI Operador'] = {
    ai_languageModel: [[{ node: 'Agente Operador', type: 'ai_languageModel', index: 0 }]],
  }
  connections['Memory Operador'] = {
    ai_memory: [[{ node: 'Agente Operador', type: 'ai_memory', index: 0 }]],
  }

  // 4. El parser lee al agente que haya corrido.
  const extraer = nodo('Extraer JSON')
  extraer.parameters.jsCode = extraer.parameters.jsCode.replace(
    "$('Agente Laundry VIP').first().json.output",
    '$input.first().json.output',
  )
  if (!extraer.parameters.jsCode.includes('$input.first().json.output'))
    throw new Error('No se pudo recablear el parser')
}

module.exports = { aplicar }
