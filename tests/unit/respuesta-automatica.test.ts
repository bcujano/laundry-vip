import { describe, expect, it } from 'vitest'
import { esRespuestaAutomatica } from '@/server/webhook/automatico'

/** Frases reales que contestaron prospectos el 2026-10-22, y las de personas que NO deben descartarse. */
describe('detector de respuestas automáticas', () => {
  it.each([
    'Gracias por comunicarte con Disfraces, El duende saltarin\n ¿Cómo podemos ayudarle?',
    '¡B&P Banquetes y Eventos!\n\nTu evento en las mejores manos\nGracias por contactar con nosotros, especificanos que necesitas, envíanos tu e-mail y te enviaremos una propuesta en la brevedad posible 👍🏼',
    'Bienvenido a Zeraty, para agilizar el proceso nos confirma:\n\nElija Su requerimiento:\n\n1.- Alquiler🍴🥂\n2.- Decoración ✨️\n3.- Asesoría ✍️',
    'Hola, este es un mensaje automático. Nuestro horario de atención es de 9 a 18.',
    'Para ventas digite la opción 1, para soporte la opción 2',
    'En este momento no podemos atenderle, le responderemos a la brevedad.',
  ])('detecta: %s', (t) => expect(esRespuestaAutomatica(t)).toBe(true))

  it.each([
    'Hola, buenas tardes. Vi su mensaje, ¿qué precios manejan para manteles?',
    'NO',
    'Necesito planchar vestido coloniales',
    'Está caro',
    'Gracias por escribirnos, nos interesa cotizar 50 manteles para un evento el sábado',
    'Bienvenido, claro que sí, ¿cuánto cuesta lavar 30 edredones?',
    'Hola, soy Marcela del catering. ¿Recogen en La Floresta?',
    '1 mantel y 2 delantales',
  ])('no descarta a una persona: %s', (t) => expect(esRespuestaAutomatica(t)).toBe(false))
})
