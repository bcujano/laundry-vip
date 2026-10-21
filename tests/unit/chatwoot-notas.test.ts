import { afterEach, describe, expect, it, vi } from 'vitest'
import { anotarEnChatwoot } from '@/server/chatwoot/notas'

/** Un Chatwoot de mentira que responde según la ruta y guarda lo que le piden. */
function falso(contactos: unknown[] = [], conversaciones: unknown[] = []) {
  const llamadas: { ruta: string; metodo: string; cuerpo: unknown }[] = []
  const buscar = (async (url: URL | string, init?: RequestInit) => {
    const ruta = String(url).split('/accounts/3')[1] ?? ''
    llamadas.push({
      ruta,
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    if (ruta === '/inboxes')
      return Response.json({ payload: [{ id: 7, channel_type: 'Channel::Whatsapp' }] })
    if (ruta.startsWith('/contacts/search')) return Response.json({ payload: contactos })
    if (ruta === '/contacts') return Response.json({ payload: { contact: { id: 55 } } })
    if (ruta.endsWith('/conversations') && ruta.startsWith('/contacts/'))
      return Response.json({ payload: conversaciones })
    if (ruta === '/conversations') return Response.json({ id: 900 })
    return Response.json({ id: 1 })
  }) as unknown as typeof fetch
  return { buscar, llamadas }
}

afterEach(() => vi.unstubAllEnvs())
const entorno = (cuenta = '3') => {
  vi.stubEnv('CHATWOOT_BASE_URL', 'https://chatwoot.test')
  vi.stubEnv('CHATWOOT_ACCOUNT_ID', cuenta)
  vi.stubEnv('CHATWOOT_API_TOKEN', 'token-de-prueba')
}

describe('notas privadas en Chatwoot', () => {
  it('crea contacto y conversación si no existen y deja la nota privada', async () => {
    entorno()
    const { buscar, llamadas } = falso()
    expect(await anotarEnChatwoot('+593900000001', 'Catering X', 'hola', buscar)).toBe(true)
    expect(llamadas.map((l) => `${l.metodo} ${l.ruta}`)).toEqual([
      'GET /inboxes',
      'GET /contacts/search?q=593900000001',
      'POST /contacts',
      'GET /contacts/55/conversations',
      'POST /conversations',
      'POST /conversations/900/messages',
    ])
    expect(llamadas.at(-1)?.cuerpo).toEqual({
      content: 'hola',
      message_type: 'outgoing',
      private: true,
    })
  })

  it('reutiliza el contacto y la conversación que ya existen', async () => {
    entorno()
    const { buscar, llamadas } = falso(
      [{ id: 9, phone_number: '+593900000001' }],
      [{ id: 321, inbox_id: 7 }],
    )
    expect(await anotarEnChatwoot('+593900000001', 'Catering X', 'hola', buscar)).toBe(true)
    expect(llamadas.map((l) => l.metodo + l.ruta)).toEqual([
      'GET/inboxes',
      'GET/contacts/search?q=593900000001',
      'GET/contacts/9/conversations',
      'POST/conversations/321/messages',
    ])
  })

  it('se niega a tocar una cuenta que no sea la 3 y no falla sin variables', async () => {
    entorno('1')
    const { buscar, llamadas } = falso()
    expect(await anotarEnChatwoot('+593900000001', 'X', 'hola', buscar)).toBe(false)
    vi.stubEnv('CHATWOOT_API_TOKEN', '')
    expect(await anotarEnChatwoot('+593900000001', 'X', 'hola', buscar)).toBe(false)
    expect(llamadas).toHaveLength(0)
  })

  it('si Chatwoot falla, devuelve false en vez de romper la bitácora', async () => {
    entorno()
    const roto = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch
    expect(await anotarEnChatwoot('+593900000001', 'X', 'hola', roto)).toBe(false)
  })
})
