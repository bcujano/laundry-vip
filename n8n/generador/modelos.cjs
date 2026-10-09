// Motor del agente de clientes: OpenAI gpt-4.1-mini como PRINCIPAL y Gemini (capa gratis) de RESPALDO.
// Mismo esquema que el agente de AIUDA Empresas (repo bcujano/aiuda-empresas,
// n8n/agente-aiuda-empresas.sdk.ts): nodo Agente v3.1 con «modelo de respaldo» activado y dos
// entradas de modelo (índice 0 principal, 1 respaldo); n8n pasa al respaldo cuando el principal
// responde con ERROR (límite, caída, cuota).
//
// Por qué NO es Gemini el principal (prueba real del 2026-10-09, simulador): con el prompt de
// Lavandería VIP y sus 6 herramientas, gemini-3.1-flash-lite NO llamó a ninguna herramienta,
// inventó «$31,50» y «48 horas» y declaró tool_consultada «cotizar_prendas». gpt-4.1-mini cuesta
// ~$0,01–0,04 al día; el ahorro no compensa el riesgo de un precio inventado. La guardia
// «valor sin herramienta» (n8n/generador/guardia.cjs) bloquea ese tipo de respuesta con cualquier modelo.
// Para volver a probar Gemini como principal: MOTOR_PRINCIPAL = 'gemini' y correr
// `pnpm tsx scripts/simular-cliente.ts` con varios casos antes de publicar.
//
// El agente de planta/dueña («Agente Operador») sigue solo con OpenAI (sus tools usan parámetros
// JSON complejos). La credencial «Gemini Aiuda» es de AIUDA (no de 321); una lavandería nueva usa la suya.
const crypto = require('node:crypto')

const MOTOR_PRINCIPAL = 'openai' // 'openai' | 'gemini'
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
    notes:
      'Respaldo gratis: solo se usa si «OpenAI Laundry» da error (ver n8n/generador/modelos.cjs).',
    credentials: CRED_GEMINI,
  })
  openai.notes = 'Motor principal del agente de clientes.'

  const gemini = MOTOR_PRINCIPAL === 'gemini'
  const entrada = (principal) => ({
    ai_languageModel: [
      [{ node: 'Agente Laundry VIP', type: 'ai_languageModel', index: principal ? 0 : 1 }],
    ],
  })
  connections['Gemini Laundry'] = entrada(gemini)
  connections['OpenAI Laundry'] = entrada(!gemini)
}

module.exports = { aplicar, MODELO_GEMINI, CRED_GEMINI }
