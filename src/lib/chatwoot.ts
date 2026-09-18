/**
 * Enlaces a la bandeja de Chatwoot de Lavandería VIP (cuenta 3). No es un
 * secreto: es la dirección que abre el navegador del equipo, con su sesión.
 */
const BASE = 'https://chatwoot-production-8564.up.railway.app/app/accounts/3'

export const CHATWOOT_BANDEJA = `${BASE}/dashboard`

export function chatwootConversacion(id: number): string {
  return `${BASE}/conversations/${id}`
}

/** Para clientes sin conversación registrada: busca por teléfono. */
export function chatwootBuscar(telefono: string): string {
  return `${BASE}/search?q=${encodeURIComponent(telefono.replace('+', ''))}`
}
