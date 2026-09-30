import { buscarCandidatos, registrarSeguimiento } from '@/server/seguimiento/repo'
import { exito, fallo, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/** Quién necesita un seguimiento ahora. n8n lo consulta cada 30 minutos. */
export async function candidatosSeguimiento(): Promise<
  ResultadoAccion<Awaited<ReturnType<typeof buscarCandidatos>>>
> {
  return exito(await buscarCandidatos())
}

/** Deja constancia de lo que se escribió (o se dejó de borrador). */
export async function anotarSeguimiento(
  parametros: ParametrosDe<'registrar_seguimiento'>,
): Promise<ResultadoAccion<{ registrado: true }>> {
  if (parametros.mensaje.trim() === '') return fallo('PARAMETROS_INVALIDOS', 'Mensaje vacío.')
  await registrarSeguimiento(parametros)
  return exito({ registrado: true })
}
