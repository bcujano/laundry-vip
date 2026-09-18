import { exigirPermiso } from '@/lib/auth'
import { respuestaCsv } from '@/server/exportar/csv'
import { csvClientes } from '@/server/exportar/repo'

export const dynamic = 'force-dynamic'

/**
 * Descarga de la base de clientes para abrir en Excel. Son datos personales
 * (LOPDP): solo quien ve reportes, no el operador de planta.
 */
export async function GET(): Promise<Response> {
  if (!(await exigirPermiso('reportes'))) {
    return new Response('No tienes permiso para descargar la base de clientes.', { status: 403 })
  }
  return respuestaCsv('clientes', await csvClientes())
}
