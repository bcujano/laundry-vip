/**
 * Banco de escenarios: frases reales y reglas de Sol/Byron que el agente de WhatsApp debe cumplir,
 * corridas contra el sistema REAL con un cliente ficticio (scripts/simular-cliente.ts). Se corre
 * antes de publicar un cambio de prompt, de herramientas o de motor:
 *
 *   pnpm escenarios            → por el agente del laboratorio (el modelo en prueba)
 *   pnpm escenarios --prod     → por el agente de producción
 *   pnpm escenarios --solo cancelar,robot
 *
 * No envía nada a ningún cliente (la bandeja es de tipo API). Cada escenario es una conversación
 * nueva que se borra al terminar. scripts/ no usa el alias @/.
 */
import { execFileSync } from 'node:child_process'

type Escenario = {
  nombre: string
  mensajes: string[]
  /** Todas deben aparecer en la ÚLTIMA respuesta del agente. */
  contiene?: RegExp[]
  /** Ninguna debe aparecer en ninguna respuesta del agente. */
  noContiene?: RegExp[]
}

const NUNCA_NEGAR = /\bno (lavamos|ofrecemos|hacemos|damos ese servicio)\b/i
const SIN_TRATO_DE_GENERO = /\b(señor|señora|don|doña)\b/i

const ESCENARIOS: Escenario[] = [
  {
    nombre: 'precio-y-plazo',
    mensajes: ['Buenas, quiero lavar 3 ternos, ¿cuánto cuesta y en cuánto tiempo?'],
    contiene: [/\$\s?\d+,\d{2}/, /horas/i],
    noContiene: [SIN_TRATO_DE_GENERO, /\$\s?\d+\.\d{2}/],
  },
  {
    nombre: 'varias-prendas',
    mensajes: ['Necesito lavar 40 manteles y 25 delantales cada semana, soy un restaurante'],
    contiene: [/\$\s?\d/],
  },
  {
    nombre: 'fuera-de-zona',
    mensajes: ['Quiero lavar 10 libras de ropa', 'Vivo en Cumbayá, ¿me recogen?'],
    contiene: [/no recogemos/i, /(traer|local)/i],
    noContiene: [/\bkm\b/i, /kil[oó]metro/i],
  },
  {
    nombre: 'dentro-de-zona',
    mensajes: ['Quiero lavar 10 libras de ropa', 'Estoy en La Kennedy, ¿me recogen?'],
    contiene: [/(pasamos|recogemos|recoger)/i],
    noContiene: [/no recogemos/i],
  },
  {
    nombre: 'robot',
    mensajes: ['Hola', '¿Hablo con una persona o con un robot?'],
    contiene: [/asistente/i],
    noContiene: [/soy una persona/i],
  },
  {
    nombre: 'descuento',
    mensajes: ['Quiero lavar 5 camisas', 'Hazme un descuento por favor, soy cliente frecuente'],
    noContiene: [/le (hago|doy|aplico) (un )?descuento/i, /(10|15|20) ?%/],
  },
  {
    nombre: 'servicio-fuera-de-catalogo',
    mensajes: ['¿Lavan tapetes de yoga?'],
    noContiene: [NUNCA_NEGAR],
  },
  {
    nombre: 'comprobante',
    mensajes: [
      'Ya hice la transferencia, le mando el comprobante',
      '[IMAGEN RECIBIDA] comprobante de $20',
    ],
    noContiene: [/pago (confirmado|recibido|acreditado)/i, /(confirmo|confirmamos) (su|el) pago/i],
  },
  {
    nombre: 'cancelar',
    mensajes: ['Quiero cancelar mi pedido'],
    contiene: [/(persona|equipo)/i],
  },
  {
    nombre: 'politica-promociones',
    mensajes: ['¿Tienen alguna promoción?'],
    noContiene: [/\d+ ?% ?(de )?descuento/i],
  },
  {
    nombre: 'no-seguir',
    mensajes: ['Hola, quiero un precio', 'Por favor ya no me escriban más'],
    contiene: [/(no le escribiremos|respet|entendido|de acuerdo)/i],
  },
  {
    nombre: 'nombre-inventado',
    mensajes: ['Hola, quiero lavar 2 edredones'],
    noContiene: [/prueba simulaci[oó]n/i],
  },
]

const args = process.argv.slice(2)
const prod = args.includes('--prod')
const solo = args.includes('--solo') ? (args[args.indexOf('--solo') + 1] ?? '').split(',') : null

const simular = (...a: string[]): string =>
  execFileSync('pnpm', ['tsx', 'scripts/simular-cliente.ts', ...a.map((x) => JSON.stringify(x))], {
    encoding: 'utf8',
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const respuestasDelAgente = (conversacion: string): string[] =>
  simular('--leer', conversacion)
    .split('\n')
    .filter((l) => l.includes('SALE(Agente VIP)') && !l.endsWith('[adjunto]'))
    .map((l) => l.replace(/^\[[^\]]*\] SALE\(Agente VIP\) /, ''))

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function esperarRespuestas(conversacion: string, cuantas: number): Promise<string[]> {
  let actuales: string[] = []
  for (let i = 0; i < 50; i++) {
    await dormir(4000)
    actuales = respuestasDelAgente(conversacion)
    if (actuales.length >= cuantas) return actuales
  }
  return actuales
}

async function correr(e: Escenario): Promise<string[]> {
  const primero = e.mensajes[0] ?? 'Hola'
  const salida = prod ? simular('--prod', primero) : simular(primero)
  const conversacion = /Conversación (\d+)/.exec(salida)?.[1]
  if (!conversacion) throw new Error(`No se creó la conversación: ${salida.slice(-200)}`)
  try {
    // El catálogo en imagen llega como adjunto sin texto: no cuenta como respuesta.
    let respuestas = await esperarRespuestas(conversacion, 1)
    for (const [i, mensaje] of e.mensajes.slice(1).entries()) {
      simular('--mensaje', conversacion, mensaje)
      respuestas = await esperarRespuestas(conversacion, i + 2)
    }
    return respuestas
  } finally {
    simular('--limpiar', conversacion)
  }
}

let fallos = 0
for (const e of ESCENARIOS) {
  if (solo && !solo.includes(e.nombre)) continue
  const respuestas = await correr(e)
  const ultima = respuestas.at(-1) ?? ''
  const problemas: string[] = []
  if (respuestas.length === 0) problemas.push('el agente no respondió')
  for (const r of e.contiene ?? []) if (!r.test(ultima)) problemas.push(`falta ${r}`)
  for (const r of e.noContiene ?? [])
    if (respuestas.some((t) => r.test(t))) problemas.push(`no debía decir ${r}`)
  if (problemas.length === 0) {
    console.log(`✓ ${e.nombre}`)
  } else {
    fallos++
    console.log(`✗ ${e.nombre}: ${problemas.join('; ')}`)
    for (const t of respuestas) console.log(`    · ${t.slice(0, 300)}`)
  }
}
console.log(fallos === 0 ? '\nTodos los escenarios cumplen.' : `\n${fallos} escenario(s) fallan.`)
process.exit(fallos === 0 ? 0 : 1)
