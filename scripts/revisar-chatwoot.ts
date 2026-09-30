import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Baja las conversaciones de Chatwoot (cuenta 3, SOLO LECTURA) para revisar
 * cómo se está portando el agente con clientes reales. Es la forma más barata y
 * rápida de auditarlo: la API devuelve la transcripción completa sin tocar n8n.
 *
 *   pnpm chatwoot:revisar                        # todo, por pantalla
 *   pnpm chatwoot:revisar --desde 2026-09-30     # solo mensajes de esa fecha en adelante
 *   pnpm chatwoot:revisar --salida chats.txt     # a un archivo
 *
 * En la salida, `SALE(Byron ADMIN)` es el AGENTE (publica con el token de esa
 * cuenta) y `SALE(<otro nombre>)` es una PERSONA respondiendo desde Chatwoot.
 * No escribe nada en Chatwoot: para quitar una etiqueta o responder, se hace a
 * mano o con una orden aparte, nunca desde este script.
 *
 * `scripts/` no usa el alias `@/`: tsx no resuelve los paths de tsconfig.
 */

const CUENTA_DE_LAVANDERIA = '3'

const RAIZ = resolve(import.meta.dirname, '..')
const archivoEnv = resolve(RAIZ, '.env.local')
if (existsSync(archivoEnv)) process.loadEnvFile(archivoEnv)

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const base = (process.env.CHATWOOT_BASE_URL ?? '').replace(/\/$/, '')
const cuenta = process.env.CHATWOOT_ACCOUNT_ID ?? ''
const token = process.env.CHATWOOT_API_TOKEN ?? ''

if (!base || !token) throw new Error('Faltan CHATWOOT_BASE_URL o CHATWOOT_API_TOKEN en .env.local.')
// La cuenta 1 es de 321 y no se toca nunca, ni siquiera para leer.
if (cuenta !== CUENTA_DE_LAVANDERIA) {
  throw new Error(
    `CHATWOOT_ACCOUNT_ID debe ser ${CUENTA_DE_LAVANDERIA} (Lavandería). Vino: "${cuenta}".`,
  )
}

type Mensaje = {
  content: string | null
  message_type: number
  created_at: number
  sender?: { name?: string }
  attachments?: unknown[]
}
type Conversacion = {
  id: number
  status: string
  labels?: string[]
  meta: { sender: { name?: string; phone_number?: string } }
}

async function api<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`${base}/api/v1/accounts/${cuenta}${ruta}`, {
    headers: { api_access_token: token },
  })
  if (!respuesta.ok) throw new Error(`${ruta} -> ${respuesta.status} ${await respuesta.text()}`)
  return (await respuesta.json()) as T
}

const desde = argumento('desde')
const desdeSegundos = desde ? new Date(`${desde}T00:00:00-05:00`).getTime() / 1000 : 0

const lista = await api<{ data: { payload: Conversacion[] } }>(
  '/conversations?status=all&per_page=50',
)

const salida: string[] = []
for (const conversacion of lista.data.payload) {
  const { payload } = await api<{ payload: Mensaje[] }>(
    `/conversations/${conversacion.id}/messages`,
  )
  const visibles = payload.filter(
    (m) => (m.content || m.attachments?.length) && m.created_at >= desdeSegundos,
  )
  if (visibles.length === 0) continue

  const { name, phone_number } = conversacion.meta.sender
  const etiquetas = (conversacion.labels ?? []).join(',') || 'ninguna'
  salida.push(
    `\n===== CONVERSACIÓN ${conversacion.id} · ${name ?? ''} · ${phone_number ?? 's/n'} · ${conversacion.status} · etiquetas: ${etiquetas}`,
  )
  for (const m of visibles) {
    const quien =
      m.message_type === 0
        ? 'CLIENTE'
        : m.message_type === 1
          ? `SALE(${m.sender?.name ?? ''})`
          : 'NOTA'
    const hora = new Date(m.created_at * 1000).toISOString().replace('T', ' ').slice(0, 16)
    const adjunto = m.attachments?.length ? ` [${m.attachments.length} adjunto(s)]` : ''
    salida.push(`[${hora}Z] ${quien} ${String(m.content ?? '').replace(/\n/g, ' ⏎ ')}${adjunto}`)
  }
}

const texto = salida.join('\n')
const destino = argumento('salida')
if (destino) {
  writeFileSync(destino, texto, 'utf8')
  console.log(`${lista.data.payload.length} conversaciones revisadas; transcripción en ${destino}`)
} else {
  console.log(texto)
}
