// Barrido de seguimiento: manda YA el primer seguimiento a los teléfonos que se le
// den, saltándose la cuenta de tiempo y el filtro de «ya le contestó una persona».
// Lo pidió el dueño (2026-09-30) para aprovechar las líneas con ventana de 24 h
// abierta. Sigue respetando: que la ventana esté abierta, que no haya hecho pedido
// y que el precio que mencione sea uno que ya se le dijo.
//
//   pnpm tsx scripts/seguimiento-barrido.ts mensajes.json [--simular]
//
// `mensajes.json` es {"+593...": "texto del seguimiento"}. Con --simular solo
// muestra el contexto de cada chat y lo que se enviaría. Deja todo registrado igual
// que el flujo de n8n:
// nota en Chatwoot (cuenta 3), memoria del agente y fila en `seguimientos` (paso 1).
import { readFileSync } from 'node:fs'
import { cargarEntorno, conectar } from './db-conexion.ts'

cargarEntorno()
const env = (k: string) => {
  const v = process.env[k]
  if (!v) throw new Error(`Falta ${k}`)
  return v.replace(/\r|"/g, '')
}

const SUPABASE = env('NEXT_PUBLIC_SUPABASE_URL')
const LLAVE = env('SUPABASE_SERVICE_ROLE_KEY')
const CW = `${env('CHATWOOT_BASE_URL')}/api/v1/accounts/3`
const TOKEN = env('CHATWOOT_API_TOKEN')
const simular = process.argv.includes('--simular')
const archivo = process.argv.slice(2).find((a) => a.endsWith('.json'))
const VENTANA_MAX_MIN = 23 * 60 + 54

async function rest<T>(ruta: string): Promise<T> {
  const r = await fetch(`${SUPABASE}/rest/v1/${ruta}`, {
    headers: { apikey: LLAVE, Authorization: `Bearer ${LLAVE}` },
  })
  return (await r.json()) as T
}

const cw = async (ruta: string, cuerpo?: unknown) => {
  const r = await fetch(`${CW}${ruta}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { api_access_token: TOKEN, 'content-type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  return (await r.json()) as Record<string, unknown>
}

function saludoDeQuito(): string {
  const hora = new Date(Date.now() - 5 * 3_600_000).getUTCHours()
  return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
}

type Fila = {
  telefono: string
  chatwoot_conversation_id: number | null
  ultima_interaccion: string
  contexto: Record<string, string | boolean | undefined>
}

/** Guardas: saludo según la hora de Quito y ningún monto que no se le haya dicho ya. */
function revisar(texto: string, dichos: string): string {
  const t = texto.trim().replace(/^(buenos d[ií]as|buenas tardes|buenas noches)/i, saludoDeQuito())
  const montos = t.match(/\$\s?\d+(?:[.,]\d+)?/g) ?? []
  return montos.some((m) => !dichos.includes(m.replace(/\s/g, ''))) ? '' : t
}

async function main() {
  if (!archivo) throw new Error('Pasa el archivo mensajes.json.')
  const mensajesPorTelefono = JSON.parse(readFileSync(archivo, 'utf8')) as Record<string, string>
  const sql = simular ? null : conectar()
  for (const [telefono, propuesto] of Object.entries(mensajesPorTelefono)) {
    const q = encodeURIComponent(telefono)
    const [fila] = await rest<Fila[]>(`conversaciones?telefono=eq.${q}&select=*`)
    if (!fila?.chatwoot_conversation_id) {
      console.log(telefono, '→ sin conversación de Chatwoot: se omite')
      continue
    }
    const minutos = (Date.now() - new Date(fila.ultima_interaccion).getTime()) / 60_000
    if (minutos >= VENTANA_MAX_MIN) {
      console.log(telefono, `→ ventana de 24 h cerrada (${Math.round(minutos)} min): se omite`)
      continue
    }
    const [cliente] = await rest<
      { id: string; nombre_contacto: string | null; nombre_contacto_origen: string }[]
    >(`clientes?telefono=eq.${q}&select=id,nombre_contacto,nombre_contacto_origen`)
    if (cliente) {
      const pedidos = await rest<unknown[]>(`pedidos?cliente_id=eq.${cliente.id}&select=id&limit=1`)
      if (pedidos.length > 0) {
        console.log(telefono, '→ ya tiene pedido: se omite')
        continue
      }
    }
    const nombre =
      cliente?.nombre_contacto && cliente.nombre_contacto_origen !== 'whatsapp'
        ? cliente.nombre_contacto
        : null

    const id = fila.chatwoot_conversation_id
    const mensajes = ((await cw(`/conversations/${id}/messages`)).payload ?? []) as {
      message_type: number
      private: boolean
      content: string | null
      sender?: { type: string; name: string }
    }[]
    const persona = [...mensajes]
      .reverse()
      .find(
        (m) =>
          m.message_type === 1 &&
          !m.private &&
          m.sender?.type === 'user' &&
          m.sender.name !== 'Byron ADMIN',
      )
    console.log(
      `${telefono} (conv ${id}, ${Math.round(minutos)} min de silencio, nombre: ${nombre ?? 'sin nombre'})`,
    )
    console.log(
      '   necesita:',
      fila.contexto.necesidad,
      '| último suyo:',
      fila.contexto.ultimo_mensaje_cliente,
    )
    console.log('   le dijimos:', fila.contexto.ultima_respuesta_agente)
    console.log('   persona del equipo:', persona?.content ?? '(nada)')
    const texto = revisar(
      propuesto,
      `${fila.contexto.ultima_respuesta_agente ?? ''} ${persona?.content ?? ''}`,
    )
    if (!texto) {
      console.log('   → menciona un monto que no se le dijo: se omite')
      continue
    }
    console.log('   ENVÍA:', texto)
    if (simular || !sql) continue

    await cw(`/conversations/${id}/messages`, {
      content: texto,
      message_type: 'outgoing',
      private: false,
    })
    const mensajeMemoria = {
      type: 'ai',
      data: { content: texto, additional_kwargs: {}, response_metadata: {} },
    }
    await sql`insert into n8n_laundry_chat_histories (session_id, message) values (${telefono.replace(/\D/g, '')}, ${sql.json(mensajeMemoria)})`
    // Se registra el paso que ya tocaba por el silencio: así el flujo normal no manda
    // enseguida otro mensaje, y sigue con el paso que viene.
    const paso = minutos >= 1410 ? 4 : minutos >= 360 ? 3 : minutos >= 60 ? 2 : 1
    await sql`insert into seguimientos (telefono, chatwoot_conversation_id, modo, mensaje, interaccion_base, paso, barrido) values (${telefono}, ${id}, 'activo', ${texto}, ${fila.ultima_interaccion}, ${paso}, true)`
    console.log('   enviado y registrado')
  }
  await sql?.end()
}

await main()
