import { generar, periodoDesdeNombre } from '@/server/reportes/repo'
import { exito, fallo, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'
import { exigirNivel } from './permisos'

/** Reporte pedido por el operador desde WhatsApp. */
export async function generarReporte(
  parametros: ParametrosDe<'generar_reporte'>,
): Promise<ResultadoAccion<unknown>> {
  // Los reportes son de administrador: un operador de planta no ve la facturación.
  const permiso = await exigirNivel(parametros.telefono_operador, 'admin')
  if (!permiso.ok) return permiso.rechazo

  const periodo =
    parametros.desde || parametros.hasta
      ? {
          desde: new Date(parametros.desde ?? '1970-01-01'),
          hasta: new Date(`${parametros.hasta ?? '2999-12-31'}T23:59:59.999Z`),
        }
      : periodoDesdeNombre('mes')

  if (Number.isNaN(periodo.desde.getTime()) || Number.isNaN(periodo.hasta.getTime())) {
    return fallo('PARAMETROS_INVALIDOS', 'Las fechas del reporte no son válidas.')
  }

  return exito(await generar(periodo))
}
