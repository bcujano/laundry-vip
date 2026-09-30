import { type AvisoPendiente, avisosPendientes, marcarAviso } from '@/server/avisos/repo'
import { exito, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/** Avisos de discrepancia por mandar. n8n los consulta cada pocos minutos. */
export async function listarAvisosPendientes(): Promise<
  ResultadoAccion<{ avisos: AvisoPendiente[] }>
> {
  return exito({ avisos: await avisosPendientes() })
}

export async function marcarAvisoAccion(
  parametros: ParametrosDe<'marcar_aviso'>,
): Promise<ResultadoAccion<{ marcado: true }>> {
  await marcarAviso(parametros.id, parametros.estado)
  return exito({ marcado: true })
}
