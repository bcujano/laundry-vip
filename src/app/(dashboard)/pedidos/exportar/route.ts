import { exigirPermiso } from '@/lib/auth'
import { respuestaCsv } from '@/server/exportar/csv'
import { csvPedidos } from '@/server/exportar/repo'

export const dynamic = 'force-dynamic'

/**
 * Descarga de la base de pedidos para abrir en Excel. Son datos personales
 * (LOPDP): solo quien ve reportes, no el operador de planta.
 */
export async function GET(): Promise<Response> {
  if (!(await exigirPermiso('reportes'))) {
    return new Response('No tienes permiso para descargar la base de pedidos.', { status: 403 })
  }
  return respuestaCsv('pedidos', await csvPedidos())
}
