import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import { marcarPlantillaEnviada, plantillasPendientes } from '@/server/plantillas/candidatos'
import { exito, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/** n8n pregunta una vez al día a quién escribirle con plantilla. Con el interruptor apagado, a nadie. */
export async function plantillasPendientesAccion(): Promise<ResultadoAccion<unknown>> {
  const config = await obtenerConfig()
  if (!config.plantillas_automaticas) return exito({ activo: false, envios: [] })
  return exito({ activo: true, envios: await plantillasPendientes() })
}

export async function marcarPlantillaAccion(
  parametros: ParametrosDe<'marcar_plantilla'>,
): Promise<ResultadoAccion<{ marcada: true }>> {
  await marcarPlantillaEnviada(parametros.telefono, parametros.plantilla, parametros.clave)
  return exito({ marcada: true })
}
