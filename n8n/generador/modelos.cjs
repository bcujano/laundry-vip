// Motor del agente de clientes: OpenAI gpt-4.1-mini como PRINCIPAL y Gemini (capa gratis) de RESPALDO.
// Mismo esquema que el agente de AIUDA Empresas (repo bcujano/aiuda-empresas,
// n8n/agente-aiuda-empresas.sdk.ts): nodo Agente v3.1 con «modelo de respaldo» activado y dos
// entradas de modelo (índice 0 principal, 1 respaldo); n8n pasa al respaldo cuando el principal
// responde con ERROR (límite, caída, cuota).
//
// Por qué NO es Gemini el principal (pruebas reales del 2026-10-09):
//  1. gemini-3.1-flash-lite NO llamó a las herramientas e inventó «$31,50» y «48 horas». Con
//     gemini-3-flash-preview + prompt compacto + herramientas de cadenas simples SÍ funciona
//     (cotiza, cubre, crea el pedido, no regala descuentos) — es el modelo de «Gemini Lab».
//  2. Pero la capa gratis de gemini-3-flash da solo 20 llamadas POR DÍA (error 429): con tools cada
//     turno gasta 2–3, así que se agota con ~4 conversaciones y la llave es la de AIUDA (Fagal).
//  3. Cuando el principal falla y entra el respaldo, la memoria del chat NO se guarda ese turno
//     (el cliente tendría que repetir todo). Mientras Gemini sea el principal, eso pasa a diario.
// Para pasar a Gemini como principal: MOTOR_PRINCIPAL = 'gemini', una llave de Google con
// facturación activa (centavos al día) y resolver el punto 3; probar con `simular-cliente.ts`.
//
// El agente de planta/dueña («Agente Operador») sigue solo con OpenAI (sus tools usan parámetros
// JSON complejos). La credencial «Gemini Aiuda» es de AIUDA (no de 321); una lavandería nueva usa la suya.
const crypto = require('node:crypto')

const MOTOR_PRINCIPAL = 'openai' // 'openai' | 'gemini'
const MODELO_GEMINI = 'models/gemini-3-flash-preview'
const CRED_GEMINI = { googlePalmApi: { id: 'jbOxhXuz7QS5IefQ', name: 'Gemini Aiuda' } }

function aplicar({ nodes, connections, nodo }) {
  const agente = nodo('Agente Laundry VIP')
  agente.typeVersion = 3.1
  agente.parameters.needsFallback = true

  // En el nodo Agente v3 las herramientas se ejecutan como pasos aparte y `.item` ya no resuelve
  // dentro del nodo de memoria («Key parameter is empty», prueba del 2026-10-09): `.first()` sí.
  nodo('Memory Laundry').parameters.sessionKey =
    "={{ $('WhatsApp Inicio').first().json.contacts[0].wa_id }}"

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

/**
 * Agente de planta y de la dueña («Agente Operador»): Gemini principal y OpenAI de respaldo, igual
 * que Fagal. Sus herramientas ya reciben cadenas sencillas (n8n/generador/operador.cjs).
 * Probado el 2026-10-10: gemini-3.1-flash-lite NO registró una orden (contestó «dame un momento» y
 * paró); gemini-3-flash-preview sí (registrar, corregir, contar, avanzar, resumen). Su capa gratis
 * da pocas llamadas al día: cuando se agota entra OpenAI de respaldo.
 */
const MODELO_OPERADOR = 'models/gemini-3-flash-preview'

function operadorConGemini({ nodes, connections, nodo }) {
  const agente = nodo('Agente Operador')
  agente.typeVersion = 3.1
  agente.parameters.needsFallback = true
  const sinItem = (v) =>
    typeof v === 'string'
      ? v.replace(
          /\$\('(WhatsApp Inicio|Preparar Mensaje Final|Verificar Operador)'\)\.item\b/g,
          "$('$1').first()",
        )
      : v
  agente.parameters.text = sinItem(agente.parameters.text)

  const openai = nodo('OpenAI Operador')
  nodes.push({
    parameters: { modelName: MODELO_OPERADOR, options: { temperature: 0.4 } },
    type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
    typeVersion: 1.1,
    position: [openai.position[0], openai.position[1] - 140],
    id: crypto.randomUUID(),
    name: 'Gemini Operador',
    notes: 'Principal del agente de planta y de la dueña; OpenAI Operador es el respaldo.',
    credentials: CRED_GEMINI,
  })
  const entrada = (indice) => ({
    ai_languageModel: [[{ node: 'Agente Operador', type: 'ai_languageModel', index: indice }]],
  })
  connections['Gemini Operador'] = entrada(0)
  connections['OpenAI Operador'] = entrada(1)
}

/**
 * Cuando el modelo principal falla y entra el de respaldo, el nodo Agente v3.1 NO guarda ese turno
 * en la memoria (prueba del 2026-10-09: el agente volvía a preguntar lo que el cliente ya había
 * dicho). Este nodo lo guarda: si la última fila de la memoria no es ya la respuesta de este turno,
 * inserta el mensaje del cliente y la respuesta. En un turno normal no hace nada.
 */
function respaldarMemoria({ nodes, connections }) {
  nodes.push({
    parameters: {
      operation: 'executeQuery',
      query:
        "INSERT INTO n8n_laundry_chat_histories (session_id, message) SELECT $1, v.m FROM (VALUES (1, $2::jsonb), (2, $3::jsonb)) AS v(o, m) WHERE $4 <> '' AND NOT EXISTS (SELECT 1 FROM (SELECT message FROM n8n_laundry_chat_histories WHERE session_id = $1 ORDER BY id DESC LIMIT 1) u WHERE u.message->>'type' = 'ai' AND position($4 in u.message->>'content') > 0) ORDER BY v.o",
      options: {
        queryReplacement:
          "={{ [($('Verificar Operador').first().json.data?.es_operador === true ? 'operador_' : '') + String($('WhatsApp Inicio').first().json.contacts[0].wa_id), JSON.stringify({ type: 'human', content: String($('Preparar Mensaje Final').first().json.message_text || ''), additional_kwargs: {}, response_metadata: {} }), JSON.stringify({ type: 'ai', content: $json.texto_limpio, tool_calls: [], additional_kwargs: {}, response_metadata: {}, invalid_tool_calls: [] }), String($json.texto_limpio || '').split(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/)[0].slice(0, 30)] }}",
      },
    },
    name: 'Respaldar Memoria',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [2960, 700],
    id: crypto.randomUUID(),
    credentials: { postgres: { id: 'uS6oHAzjK8OQg6K3', name: 'Postgres Laundry VIP' } },
    onError: 'continueRegularOutput',
    notes:
      'Guarda el turno en la memoria si el agente no lo hizo (pasa cuando entra el modelo de respaldo).',
  })
  connections['Extraer JSON'].main[0].push({ node: 'Respaldar Memoria', type: 'main', index: 0 })
}

/**
 * El nodo Agente v3 corta el emparejado de ítems (paired items): después de él, `$('X').item`
 * ya no resuelve y el nodo falla con una URL vacía (`/conversations//messages`, prueba del
 * 2026-10-09). El flujo de un mensaje tiene un solo ítem, así que `.first()` es equivalente.
 * Se corrige en todo lo que cuelga del agente; los flujos de seguimiento y avisos (varios
 * ítems, no cuelgan del agente) conservan `.item`.
 */
const NODOS_DE_UN_ITEM = [
  'WhatsApp Inicio',
  'Preparar Mensaje Final',
  'Extraer JSON',
  'Verificar Operador',
  'Chatwoot Webhook',
]

function descendientes(connections, origen) {
  const vistos = new Set()
  const pila = [origen]
  while (pila.length) {
    const actual = pila.pop()
    for (const salidas of Object.values(connections[actual]?.main ?? [])) {
      for (const c of salidas)
        if (!vistos.has(c.node)) {
          vistos.add(c.node)
          pila.push(c.node)
        }
    }
  }
  return vistos
}

function corregirPares({ nodes, connections }) {
  const patron = new RegExp(
    String.raw`\$\('(` + NODOS_DE_UN_ITEM.join('|') + String.raw`)'\)\.item\b`,
    'g',
  )
  const reemplazar = (valor) => {
    if (typeof valor === 'string') return valor.replace(patron, "$('$1').first()")
    if (Array.isArray(valor)) return valor.map(reemplazar)
    if (valor && typeof valor === 'object')
      return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, reemplazar(v)]))
    return valor
  }
  const afectados = descendientes(connections, 'Agente Laundry VIP')
  for (const n of nodes) if (afectados.has(n.name)) n.parameters = reemplazar(n.parameters)
}

module.exports = {
  aplicar,
  operadorConGemini,
  corregirPares,
  respaldarMemoria,
  MODELO_GEMINI,
  CRED_GEMINI,
}
