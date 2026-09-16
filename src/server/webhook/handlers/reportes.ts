import { supabaseAdmin } from '@/lib/supabase/admin'
import { generar, periodoDesdeNombre } from '@/server/reportes/repo'
import { exito, fallo, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/** Reporte pedido por el operador desde WhatsApp. */
export async function generarReporte(
  parametros: ParametrosDe<'generar_reporte'>,
): Promise<ResultadoAccion<unknown>> {
  const { data } = await supabaseAdmin()
    .from('operador_whitelist')
    .select('id')
    .eq('telefono', parametros.telefono_operador)
    .eq('activo', true)
    .maybeSingle()

  if (!data) {
    return fallo('OPERADOR_NO_AUTORIZADO', 'Ese número no está autorizado como operador.', 403)
  }

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
