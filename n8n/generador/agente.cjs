// Quién es el agente en Chatwoot. Hasta el 2026-10-01 el agente publicaba con el
// token de «Byron ADMIN» (el dueño); desde entonces tiene su propio usuario, así que
// lo que escriba Byron a mano en Chatwoot ya es «una persona» y pausa al agente.
//
// Los mensajes VIEJOS de «Byron ADMIN» (anteriores al corte) siguen siendo del
// agente: sin esa excepción el historial parecería lleno de intervenciones humanas.
const NOMBRE_AGENTE = 'Agente VIP'
const NOMBRE_ANTERIOR = 'Byron ADMIN'
// 2026-10-01T00:30:00Z, en segundos como los entrega Chatwoot.
const CORTE_EPOCH = 1790814600

/** Función JS lista para pegar dentro de un nodo de n8n: ¿este mensaje lo escribió el agente? */
const ES_AGENTE_JS = `const esAgente = (m) => !!(m.sender && (m.sender.name === '${NOMBRE_AGENTE}' || (m.sender.name === '${NOMBRE_ANTERIOR}' && m.created_at < ${CORTE_EPOCH})));`

module.exports = { NOMBRE_AGENTE, NOMBRE_ANTERIOR, CORTE_EPOCH, ES_AGENTE_JS }
