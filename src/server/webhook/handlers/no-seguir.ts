import { supabaseAdmin } from '@/lib/supabase/admin'
import { exito, fallo, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/**
 * El cliente pidió que no le escriban más: se marca la conversación y el seguimiento automático
 * no vuelve a contactarlo. Lo decide el servidor, no el modelo.
 */
export async function noSeguir(
  parametros: ParametrosDe<'no_seguir'>,
): Promise<ResultadoAccion<{ marcado: true }>> {
  const { error } = await supabaseAdmin()
    .from('conversaciones')
    .upsert({ telefono: parametros.telefono, no_seguir: true }, { onConflict: 'telefono' })
  if (error) return fallo('ERROR_INTERNO', 'No se pudo registrar la petición.', 500)
  return exito({ marcado: true })
}
