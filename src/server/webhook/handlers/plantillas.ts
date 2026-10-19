import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import { marcarPlantillaEnviada, plantillasPendientes } from '@/server/plantillas/candidatos'
import { prospectosPendientes } from '@/server/prospectos/candidatos'
import { PLANTILLA_PRIMER_CONTACTO } from '@/server/prospectos/mensaje'
import { marcarContactadoPorPlantilla } from '@/server/prospectos/repo'
import { exito, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/**
 * n8n pregunta una vez al día a quién escribirle con plantilla. Son dos interruptores independientes
 * de Configuración: los mensajes a CLIENTES (reactivación, ropa no retirada) y la prospección a
 * negocios que nunca han escrito. Con los dos apagados, a nadie.
 */
export async function plantillasPendientesAccion(): Promise<ResultadoAccion<unknown>> {
  const config = await obtenerConfig()
  if (!config.plantillas_automaticas && !config.prospeccion_automatica) {
    return exito({ activo: false, envios: [] })
  }

  const [aClientes, aProspectos] = await Promise.all([
    config.plantillas_automaticas ? plantillasPendientes() : [],
    config.prospeccion_automatica
      ? prospectosPendientes(new Date(), config.prospeccion_limite_diario)
      : [],
  ])
  return exito({ activo: true, envios: [...aClientes, ...aProspectos] })
}

export async function marcarPlantillaAccion(
  parametros: ParametrosDe<'marcar_plantilla'>,
): Promise<ResultadoAccion<{ marcada: true }>> {
  await marcarPlantillaEnviada(parametros.telefono, parametros.plantilla, parametros.clave)
  // El primer contacto lleva el id del prospecto en la clave: ya no es «nuevo».
  if (parametros.plantilla === PLANTILLA_PRIMER_CONTACTO) {
    await marcarContactadoPorPlantilla(parametros.clave)
  }
  return exito({ marcada: true })
}
