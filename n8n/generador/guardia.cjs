// Guardia anti-alucinación: una confirmación de escritura solo sale si la tool corrió y respondió ok.
const GUARDIA = `
// ── Guardia anti-alucinación ─────────────────────────────────────────────
// El modelo puede escribir "✅ Orden registrada" con un ID inventado sin haber
// llamado a la herramienta. Solo vale lo que la herramienta devolvió ok:true
// en ESTE turno; un UUID que no salió de una herramienta es inventado.
const pasos = Array.isArray($input.first().json.intermediateSteps) ? $input.first().json.intermediateSteps : [];
const ESCRITURAS = ['registrar_cliente_presencial', 'actualizar_registro', 'avanzar_estado', 'registrar_conteo', 'crear_pedido'];
const observaciones = pasos.map((p) => String((p && p.observation) || '')).join(' ');
const escriturasOk = pasos.filter((p) => p && p.action && ESCRITURAS.includes(p.action.tool) && /"ok"\\s*:\\s*true/.test(String(p.observation || '')));
const textoModelo = String(parsed.respuesta_lead || '');
const uuids = textoModelo.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
const idInventado = uuids.some((id) => !observaciones.includes(id));
const escrituraFantasma = ESCRITURAS.includes(parsed.tool_consultada) && escriturasOk.length === 0;
let esOperadorGuardia = false;
try { esOperadorGuardia = $('Verificar Operador').first().json.data?.es_operador === true; } catch (e) {}
const confirmacionFalsa = !parseFailed && (idInventado || escrituraFantasma);
if (confirmacionFalsa) {
  parsed.respuesta_lead = esOperadorGuardia
    ? '⚠️ La orden NO quedó registrada: no llegué a guardarla en el sistema. Responde «registrar» y la guardo ahora con los mismos datos.'
    : 'Disculpe, no pude completar el registro en este momento. Una persona de nuestro equipo lo revisa y le confirma en breve.';
  if (!esOperadorGuardia) parsed.escalar_humano = true;
}
`

function aplicar({ nodo }) {
  for (const nombre of ['Agente Laundry VIP', 'Agente Operador']) {
    nodo(nombre).parameters.options.returnIntermediateSteps = true
  }
  const extraer = nodo('Extraer JSON')
  const ancla = 'const imagenes = Array.isArray(parsed.imagenes)'
  if (!extraer.parameters.jsCode.includes(ancla))
    throw new Error('No encontré dónde poner la guardia')
  extraer.parameters.jsCode = extraer.parameters.jsCode
    .replace(ancla, `${GUARDIA}\n${ancla}`)
    .replace(
      '    parser_failed: parseFailed,',
      '    parser_failed: parseFailed,\n    confirmacion_falsa: confirmacionFalsa,',
    )
  if (!extraer.parameters.jsCode.includes('confirmacion_falsa: confirmacionFalsa'))
    throw new Error('No se marcó el flag')
}

module.exports = { aplicar }
