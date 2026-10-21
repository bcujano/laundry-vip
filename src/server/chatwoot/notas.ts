/**
 * Deja en Chatwoot (cuenta 3, la de Lavandería VIP) una nota privada en la conversación del prospecto, para
 * que quien atienda la bandeja vea toda la historia de la prospección junto a los mensajes: el mensaje en
 * frío, las llamadas y los seguimientos. Los envíos por plantilla salen directo por la API de Meta y no
 * pasan por Chatwoot, por eso se anotan aquí.
 *
 * Las notas privadas no pausan al agente (solo un mensaje saliente público de otra persona lo hace).
 * Es de mejor esfuerzo: si Chatwoot falla o faltan las variables, la bitácora del CRM igual queda.
 * Se niega a tocar cualquier cuenta que no sea la 3: la 1 es de 321.
 */
type Buscar = typeof fetch

const TIEMPO_MS = 8000

function configuracion() {
  const base = process.env.CHATWOOT_BASE_URL?.trim().replace(/\/$/, '')
  const cuenta = process.env.CHATWOOT_ACCOUNT_ID?.trim()
  const token = process.env.CHATWOOT_API_TOKEN?.trim()
  if (!base || !token || cuenta !== '3') return null
  return { api: `${base}/api/v1/accounts/${cuenta}`, token }
}

type Contacto = { id: number; phone_number?: string | null }

export async function anotarEnChatwoot(
  telefono: string,
  nombre: string,
  texto: string,
  buscar: Buscar = fetch,
): Promise<boolean> {
  const config = configuracion()
  if (!config) return false
  const llamar = async (ruta: string, metodo = 'GET', cuerpo?: unknown) => {
    const r = await buscar(`${config.api}${ruta}`, {
      method: metodo,
      headers: { api_access_token: config.token, 'content-type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(TIEMPO_MS),
    })
    if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status}`)
    return (await r.json()) as Record<string, unknown>
  }

  try {
    const inboxes = (await llamar('/inboxes')) as {
      payload?: { id: number; channel_type: string }[]
    }
    const bandeja = inboxes.payload?.find((i) => i.channel_type === 'Channel::Whatsapp')
    if (!bandeja) return false

    // 1. El contacto: se busca por teléfono y, si no existe, se crea.
    const digitos = telefono.replace('+', '')
    const encontrados = (await llamar(`/contacts/search?q=${encodeURIComponent(digitos)}`)) as {
      payload?: Contacto[]
    }
    let contacto = encontrados.payload?.find((c) => c.phone_number?.replace('+', '') === digitos)
    if (!contacto) {
      const creado = (await llamar('/contacts', 'POST', {
        inbox_id: bandeja.id,
        name: nombre,
        phone_number: telefono,
      })) as { payload?: { contact?: Contacto } }
      contacto = creado.payload?.contact
    }
    if (!contacto) return false

    // 2. La conversación: la más reciente de esa bandeja o, si no hay, una nueva.
    const conversaciones = (await llamar(`/contacts/${contacto.id}/conversations`)) as {
      payload?: { id: number; inbox_id: number }[]
    }
    let conversacion = conversaciones.payload?.find((c) => c.inbox_id === bandeja.id)?.id
    if (!conversacion) {
      const nueva = (await llamar('/conversations', 'POST', {
        inbox_id: bandeja.id,
        contact_id: contacto.id,
        source_id: digitos,
        status: 'pending',
      })) as { id?: number }
      conversacion = nueva.id
    }
    if (!conversacion) return false

    // 3. La nota privada.
    await llamar(`/conversations/${conversacion}/messages`, 'POST', {
      content: texto,
      message_type: 'outgoing',
      private: true,
    })
    return true
  } catch {
    return false
  }
}
