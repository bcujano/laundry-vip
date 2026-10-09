// Motor del agente de clientes: Gemini (capa gratis) como principal y OpenAI de respaldo.
// Mismo esquema que el agente de AIUDA Empresas (repo bcujano/aiuda-empresas, n8n/agente-aiuda-empresas.sdk.ts):
// el nodo Agente (v3.1) con «modelo de respaldo» activado y dos entradas de modelo:
//   índice 0 → Gemini (principal) · índice 1 → OpenAI gpt-4.1-mini (respaldo).
// n8n pasa al respaldo cuando el principal responde con ERROR (límite de la capa gratis, caída,
// esquema rechazado). Si Gemini contesta mal pero sin error, no hay respaldo: por eso el
// parser («Extraer JSON») y la guardia siguen en pie y el agente se revisa con `pnpm chatwoot:revisar`.
//
// El agente de planta/dueña («Agente Operador») sigue solo con OpenAI hasta probar sus tools
// con Gemini (usan parámetros JSON complejos).
//
// La credencial «Gemini Aiuda» es de AIUDA (no de 321). Una lavandería nueva usa la suya.
const crypto = require('node:crypto')

const MODELO_GEMINI = 'models/gemini-3.1-flash-lite'
const CRED_GEMINI = { googlePalmApi: { id: 'jbOxhXuz7QS5IefQ', name: 'Gemini Aiuda' } }

function aplicar({ nodes, connections, nodo }) {
  const agente = nodo('Agente Laundry VIP')
  agente.typeVersion = 3.1
  agente.parameters.needsFallback = true

  const openai = nodo('OpenAI Laundry')
  nodes.push({
    parameters: {
      modelName: MODELO_GEMINI,
      // Como en el agente de AIUDA Empresas. Gemini 3 se degrada con temperatura 0 y el tope de
      // salida cuenta también el razonamiento: ni topP ni maxOutputTokens, para no cortar el JSON.
      options: { temperature: 0.4 },
    },
    type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
    typeVersion: 1.1,
    position: [openai.position[0], openai.position[1] - 140],
    id: crypto.randomUUID(),
    name: 'Gemini Laundry',
    notes: 'Motor principal (capa gratis). Si falla, n8n usa «OpenAI Laundry» (respaldo).',
    credentials: CRED_GEMINI,
  })
  openai.notes = 'Respaldo: solo se usa si «Gemini Laundry» da error.'

  connections['Gemini Laundry'] = {
    ai_languageModel: [[{ node: 'Agente Laundry VIP', type: 'ai_languageModel', index: 0 }]],
  }
  // El OpenAI pasa a la segunda entrada: el modelo de respaldo.
  connections['OpenAI Laundry'] = {
    ai_languageModel: [[{ node: 'Agente Laundry VIP', type: 'ai_languageModel', index: 1 }]],
  }
}

module.exports = { aplicar, MODELO_GEMINI, CRED_GEMINI }
