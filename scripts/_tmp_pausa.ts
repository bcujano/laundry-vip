import { execFileSync } from 'node:child_process'
import { cargarEntorno } from './db-conexion.ts'

cargarEntorno()
const B = `${process.env.CHATWOOT_BASE_URL}/api/v1/accounts/3`
const h = {
  api_access_token: process.env.CHATWOOT_API_TOKEN ?? '',
  'content-type': 'application/json',
}
const api = async (r: string, m = 'GET', b?: unknown) => {
  const x = await fetch(B + r, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined })
  const t = await x.text()
  return t ? JSON.parse(t) : {}
}
const sim = (...a: string[]) =>
  execFileSync('pnpm', ['tsx', 'scripts/simular-cliente.ts', ...a.map((x) => JSON.stringify(x))], {
    encoding: 'utf8',
    shell: true,
  })
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
const agente = (c: string) =>
  sim('--leer', c)
    .split('\n')
    .filter((l) => l.includes('SALE(Agente VIP)') && !l.endsWith('[adjunto]'))

const salida = sim('--prod', 'Hola, quiero lavar 3 ternos')
const c = /Conversación (\d+)/.exec(salida)?.[1] as string
try {
  for (let i = 0; i < 40 && agente(c).length < 1; i++) await esperar(4000)
  await api(`/conversations/${c}/messages`, 'POST', {
    content:
      'Hola, soy del equipo. Los 3 ternos quedan en $20,00 en total, y yo mismo los recojo mañana a las 10.',
    message_type: 'outgoing',
    private: false,
  })
  await esperar(12000)
  // la persona suelta el chat: quita la etiqueta humano
  await api(`/conversations/${c}/labels`, 'POST', { labels: [] })
  const antes = agente(c).length
  sim('--mensaje', c, '#prod Perfecto, ¿cuánto era en total y a qué hora vienen?')
  for (let i = 0; i < 40 && agente(c).length <= antes; i++) await esperar(4000)
  console.log('RESPUESTA TRAS LA PERSONA:', agente(c).at(-1))
} finally {
  sim('--limpiar', c)
}
