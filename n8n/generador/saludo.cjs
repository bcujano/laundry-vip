// Saludo del seguimiento: lo fija el código según la hora de Quito (UTC-5), nunca el modelo.
// El patrón cubre las variantes que el modelo escribió de verdad («Buen día», «Buen mediodía»).
const PATRON =
  '^(buenos d[ií]as|buenas tardes|buenas noches|buen d[ií]a|buen mediod[ií]a|buena tarde|buena noche)'

function saludoDeHora(hora) {
  return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function corregirSaludo(texto, hora) {
  return texto.replace(new RegExp(PATRON, 'i'), saludoDeHora(hora))
}

module.exports = { PATRON, saludoDeHora, corregirSaludo }
