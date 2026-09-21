import { verifyAuth } from '@/lib/auth'
import { csvCatalogo } from '@/server/exportar/catalogo'
import { respuestaCsv } from '@/server/exportar/csv'

export const dynamic = 'force-dynamic'

/**
 * La lista de precios viva, para imprimir o mandar. No son datos personales:
 * la puede descargar cualquiera que entre al CRM, incluido el operador.
 */
export async function GET(): Promise<Response> {
  if ((await verifyAuth()) === null) {
    return new Response('Inicia sesión para descargar la lista de precios.', { status: 401 })
  }
  return respuestaCsv('lista-de-precios', await csvCatalogo())
}
