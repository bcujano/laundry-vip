/**
 * Simula a un cliente NUEVO escribiendo al agente, para verificar un cambio contra el sistema real
 * (motor del modelo, prompt, herramientas) sin usar el número de nadie.
 *
 *   pnpm tsx scripts/simular-cliente.ts "Hola, quiero lavar 3 ternos"          → crea la prueba y manda el mensaje
 *   pnpm tsx scripts/simular-cliente.ts --prod "texto"                          → igual, pero por el agente de PRODUCCIÓN (el normal)
 *   pnpm tsx scripts/simular-cliente.ts --leer <conversacion>                  → muestra lo que contestó el agente
 *   pnpm tsx scripts/simular-cliente.ts --mensaje <conversacion> "texto"       → otro mensaje del mismo cliente
 *   pnpm tsx scripts/simular-cliente.ts --limpiar <conversacion>               → borra conversación, contacto y filas del CRM
 *
 * Usa un teléfono ficticio fijo (+593 22 000 0771) en la cuenta 3 de Chatwoot (la de Lavandería VIP;
 * el script se niega a correr con otra) y una bandeja propia de tipo API («PRUEBAS simulación»,
 * que crea sola): Chatwoot no deja crear mensajes entrantes en la bandeja de WhatsApp, y en una
 * bandeja API la respuesta del agente NO sale a ningún WhatsApp, solo queda en la conversación.
 * El webhook de la cuenta le avisa a n8n igual que con un cliente real.
 * scripts/ no usa el alias @/.
 */
import { cargarEntorno, conectar } from './db-conexion.ts'

cargarEntorno()
const BASE = process.env.CHATWOOT_BASE_URL ?? ''
const CUENTA = process.env.CHATWOOT_ACCOUNT_ID ?? ''
const TOKEN = process.env.CHATWOOT_API_TOKEN ?? ''
const TELEFONO = '+59322000771'
const DIGITOS = TELEFONO.replace('+', '')

if (CUENTA !== '3')
  throw new Error('Solo la cuenta 3 (Lavandería VIP). La 1 es de 321 y no se toca.')

async function api(ruta: string, metodo = 'GET', cuerpo?: unknown) {
  const r = await fetch(`${BASE}/api/v1/accounts/${CUENTA}${ruta}`, {
    method: metodo,
    headers: { api_access_token: TOKEN, 'content-type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status} ${texto.slice(0, 200)}`)
  return texto ? JSON.parse(texto) : {}
}

async function enviar(conversacion: number, texto: string) {
  await api(`/conversations/${conversacion}/messages`, 'POST', {
    content: texto,
    message_type: 'incoming',
    private: false,
  })
}

async function leer(conversacion: number) {
  const { payload } = await api(`/conversations/${conversacion}/messages`)
  for (const m of payload as {
    id: number
    message_type: number
    private: boolean
    created_at: number
    content: string | null
    sender?: { name?: string }
  }[]) {
    const quien =
      m.message_type === 0 ? 'CLIENTE' : m.private ? 'NOTA' : `SALE(${m.sender?.name ?? '?'})`
    console.log(
      `[${new Date(m.created_at * 1000).toISOString().slice(11, 19)}Z] ${quien} ${m.content ?? '[adjunto]'}`,
    )
  }
}

async function limpiar(conversacion: number) {
  const conv = await api(`/conversations/${conversacion}`)
  const contacto = conv.meta?.sender?.id as number | undefined
  if (conv.meta?.sender?.phone_number !== TELEFONO) {
    throw new Error('Esa conversación no es la de la simulación: no se borra.')
  }
  await api(`/conversations/${conversacion}`, 'DELETE').catch(() => {})
  if (contacto) await api(`/contacts/${contacto}`, 'DELETE').catch(() => {})
  const sql = conectar()
  try {
    await sql`delete from n8n_laundry_chat_histories where session_id = ${DIGITOS}`
    await sql`delete from conversaciones where telefono = ${TELEFONO}`
    await sql`delete from clientes where telefono = ${TELEFONO}`
  } finally {
    await sql.end()
  }
  const inbox = ((await api('/inboxes')).payload as { id: number; name: string }[]).find(
    (i) => i.name === BANDEJA,
  )
  if (inbox) await api(`/inboxes/${inbox.id}`, 'DELETE').catch(() => {})
  console.log('Simulación borrada (Chatwoot y CRM).')
}

/** Usuario de Chatwoot con el que publica el agente (docs/AGENTE.md §7). */
const AGENTE_VIP = 8
const BANDEJA = 'PRUEBAS simulación (borrar)'

async function bandeja(): Promise<number> {
  const lista = (await api('/inboxes')).payload as { id: number; name: string }[]
  const existente = lista.find((i) => i.name === BANDEJA)
  if (existente) return existente.id
  const nueva = await api('/inboxes', 'POST', { name: BANDEJA, channel: { type: 'api' } })
  // «Agente VIP» (usuario 8) tiene que ser miembro, o Chatwoot le niega leer y responder (401).
  await api('/inbox_members', 'POST', { inbox_id: nueva.id, user_ids: [AGENTE_VIP] })
  return nueva.id
}

async function crearConversacion(inbox: number): Promise<number> {
  const contacto = await api('/contacts', 'POST', {
    inbox_id: inbox,
    name: 'PRUEBA simulación (borrar)',
    phone_number: TELEFONO,
  })
  const id = contacto.payload?.contact?.id ?? contacto.id
  const origen = (contacto.payload?.contact_inbox ?? contacto.contact_inbox)?.source_id ?? DIGITOS
  const conv = await api('/conversations', 'POST', {
    source_id: origen,
    inbox_id: inbox,
    contact_id: id,
  })
  return conv.id as number
}

const [a, b, c] = process.argv.slice(2)
if (a === '--leer') await leer(Number(b))
else if (a === '--mensaje') await enviar(Number(b), c ?? '')
else if (a === '--limpiar') await limpiar(Number(b))
else if (a === '--prod') {
  // Pasa por el agente de PRODUCCIÓN (no por el de laboratorio): el mensaje empieza por «#prod».
  const conv = await crearConversacion(await bandeja())
  await enviar(conv, `#prod ${b ?? 'Hola'}`)
  console.log(`Conversación ${conv} (agente de producción). Lee la respuesta con: --leer ${conv}`)
} else {
  const conv = await crearConversacion(await bandeja())
  await enviar(conv, a ?? 'Hola')
  console.log(`Conversación ${conv} (agente de laboratorio). Lee la respuesta con: --leer ${conv}`)
}
