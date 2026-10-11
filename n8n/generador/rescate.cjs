// Rescate de la respuesta cuando el modelo cierra mal el JSON.
//
// Un modelo en modo JSON a temperatura 0 llegó a dejar una comilla sin cerrar y a seguir hablando
// hasta el tope de tokens (2026-10-11, gpt-4.1-mini): el parser fallaba y el cliente quedaba
// escalado a una persona por nada, aunque el texto para él estaba íntegro. Aquí se rescata ese
// texto con una expresión regular; si no hay nada que rescatar, queda el fallback de siempre.
const MARCA_INICIO = '  parseFailed = true;\n  parsed = {'
const MARCA_CIERRE = '\n  };\n}'

const RESCATE = String.raw`  const rescate = (String(rawOutput).match(/"respuesta_lead"\s*:\s*"((?:[^"\\]|\\.)*)"/) || [])[1];
  let salvado = '';
  try { salvado = rescate ? JSON.parse('"' + rescate + '"').trim() : ''; } catch (e2) {}
  if (salvado) {
    parsed = { respuesta_lead: salvado, tool_consultada: null, imagenes: [], videos: [], ubicacion: false, escalar_humano: false, metadata: { temperatura: 'tibio', pain_point: '', objeciones: [], next_action: 'esperar_respuesta', quality_score: 1, tipo_lead: 'otro', datos_lead: {} } };
  } else {
  parseFailed = true;
  parsed = {`

function aplicar(extraer) {
  const codigo = extraer.parameters.jsCode
  const inicio = codigo.indexOf(MARCA_INICIO)
  const cierre = inicio === -1 ? -1 : codigo.indexOf(MARCA_CIERRE, inicio)
  if (inicio === -1 || cierre === -1) {
    throw new Error('No encontré el fallback del parser de Extraer JSON')
  }
  // El fallback original pasa a ser el «else»: se cierra una llave más al terminar el bloque.
  extraer.parameters.jsCode =
    codigo.slice(0, inicio) +
    RESCATE +
    codigo.slice(inicio + MARCA_INICIO.length, cierre) +
    '\n  };\n  }\n}' +
    codigo.slice(cierre + MARCA_CIERRE.length)
}

module.exports = { aplicar }
