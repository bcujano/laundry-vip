// Laboratorio de modelos: un segundo agente («Agente Laundry VIP (lab)») que SOLO atiende a la
// bandeja de pruebas de Chatwoot («PRUEBAS simulación (borrar)», ver scripts/simular-cliente.ts).
// Sirve para probar un modelo, un prompt o una herramienta contra el sistema real SIN exponer a un
// cliente: la rama normal no cambia nunca. Comparte con el agente de producción las herramientas,
// la memoria, el respaldo de OpenAI y todo lo que va después (parser, guardia, respuesta, CRM).
//
//   ¿Es Operador? (no) → ¿Es Prueba? ─ no → Agente Laundry VIP        (producción)
//                                      └ sí → Agente Laundry VIP (lab)  (modelo a probar)
//
// Un mensaje de la simulación que empiece por «#prod» va a la rama de producción: así se prueba
// también esa rama sin un cliente real (`simular-cliente.ts --prod`).
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const BANDEJA_PRUEBAS = 'PRUEBAS simulación (borrar)'
const MODELO_LAB = 'models/gemini-3-flash-preview'
const CRED_GEMINI = { googlePalmApi: { id: 'jbOxhXuz7QS5IefQ', name: 'Gemini Aiuda' } }

function aplicar({ nodes, connections, nodo }) {
  const prod = nodo('Agente Laundry VIP')
  const lab = JSON.parse(JSON.stringify(prod))
  lab.name = 'Agente Laundry VIP (lab)'
  lab.id = crypto.randomUUID()
  lab.position = [prod.position[0], prod.position[1] + 520]
  lab.notes = 'Solo atiende la bandeja de pruebas. Modelo a probar: «Gemini Lab».'
  // Prompt del laboratorio: el mismo que producción, salvo que exista `n8n/prompt-laboratorio.md`
  // (un experimento en curso). Así se prueba un prompt nuevo sin tocar a ningún cliente.
  const archivoLab = path.join(__dirname, '..', 'prompt-laboratorio.md')
  if (fs.existsSync(archivoLab)) {
    lab.parameters.options.systemMessage = fs.readFileSync(archivoLab, 'utf8').replace(/\n$/, '')
  }
  nodes.push(lab)

  nodes.push({
    parameters: { modelName: MODELO_LAB, options: { temperature: 0.4 } },
    type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
    typeVersion: 1.1,
    position: [lab.position[0] - 272, lab.position[1] + 40],
    id: crypto.randomUUID(),
    name: 'Gemini Lab',
    notes: 'Modelo en prueba (laboratorio). Cambiar aquí el modelName para probar otro.',
    credentials: CRED_GEMINI,
  })

  nodes.push({
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'es-prueba',
            leftValue: `={{ ($('Chatwoot Webhook').first().json.body?.inbox?.name || '') === '${BANDEJA_PRUEBAS}' && !String($('Chatwoot Webhook').first().json.body?.content || '').startsWith('#prod') }}`,
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    name: '¿Es Prueba?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.2,
    position: [prod.position[0] - 272, prod.position[1] + 260],
    id: crypto.randomUUID(),
    notes:
      'Laboratorio: solo la bandeja «PRUEBAS simulación (borrar)» (y sin «#prod») va al agente de prueba.',
  })

  // ¿Es Operador? (no) → ¿Es Prueba? → producción o laboratorio.
  const salidaNoOperador = connections['¿Es Operador?'].main[1]
  if (salidaNoOperador?.[0].node !== 'Agente Laundry VIP') {
    throw new Error('No encontré la rama de clientes del agente')
  }
  connections['¿Es Operador?'].main[1] = [{ node: '¿Es Prueba?', type: 'main', index: 0 }]
  connections['¿Es Prueba?'] = {
    main: [
      [{ node: 'Agente Laundry VIP (lab)', type: 'main', index: 0 }],
      [{ node: 'Agente Laundry VIP', type: 'main', index: 0 }],
    ],
  }
  connections['Agente Laundry VIP (lab)'] = {
    main: [[{ node: 'Extraer JSON', type: 'main', index: 0 }]],
  }
  // Modelo en prueba como principal y el respaldo de OpenAI compartido.
  connections['Gemini Lab'] = {
    ai_languageModel: [[{ node: 'Agente Laundry VIP (lab)', type: 'ai_languageModel', index: 0 }]],
  }
  connections['OpenAI Laundry'].ai_languageModel[0].push({
    node: 'Agente Laundry VIP (lab)',
    type: 'ai_languageModel',
    index: 1,
  })
  // Memoria y herramientas compartidas.
  const agregarSalida = (origen, tipo) => {
    connections[origen][tipo][0].push({ node: 'Agente Laundry VIP (lab)', type: tipo, index: 0 })
  }
  agregarSalida('Memory Laundry', 'ai_memory')
  for (const [origen, v] of Object.entries(connections)) {
    if (v.ai_tool?.[0].some((d) => d.node === 'Agente Laundry VIP'))
      agregarSalida(origen, 'ai_tool')
  }
}

module.exports = { aplicar, BANDEJA_PRUEBAS }
