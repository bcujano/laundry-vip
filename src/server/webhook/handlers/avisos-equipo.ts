import { frasePlazoHumano } from '@/server/avisos-equipo/horario-habil'
import {
  atenderAvisosDeConversacion,
  avisosPorEnviar,
  crearAvisoEquipo,
  horarioDelLocal,
  marcarAvisoEquipo,
} from '@/server/avisos-equipo/repo'
import { TIPOS_AVISO } from '@/server/avisos-equipo/tipos'
import { exito, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/**
 * El agente (o un flujo) escala un caso: se crea UN aviso por caso y se devuelve la frase
 * con que se le promete respuesta al cliente. La frase la calcula el servidor con el horario
 * del local: el modelo nunca inventa un plazo.
 */
export async function crearAvisoEquipoAccion(
  parametros: ParametrosDe<'crear_aviso_equipo'>,
): Promise<ResultadoAccion<{ creado: boolean; plazo_respuesta: string }>> {
  const tipo = parametros.tipo in TIPOS_AVISO ? parametros.tipo : 'otro'
  const { creado } = await crearAvisoEquipo({ ...parametros, tipo })
  return exito({
    creado,
    plazo_respuesta: frasePlazoHumano(new Date(), await horarioDelLocal()),
  })
}

export async function avisosEquipoPendientesAccion() {
  return exito(await avisosPorEnviar())
}

export async function marcarAvisoEquipoAccion(
  parametros: ParametrosDe<'marcar_aviso_equipo'>,
): Promise<ResultadoAccion<{ marcado: true }>> {
  await marcarAvisoEquipo(parametros.id, parametros.estado)
  return exito({ marcado: true })
}

export async function atenderAvisosAccion(
  parametros: ParametrosDe<'atender_avisos_equipo'>,
): Promise<ResultadoAccion<{ atendidos: number }>> {
  return exito({
    atendidos: await atenderAvisosDeConversacion(parametros.chatwoot_conversation_id),
  })
}
