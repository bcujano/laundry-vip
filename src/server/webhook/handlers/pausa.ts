import { horarioDelLocal } from '@/server/avisos-equipo/repo'
import { evaluarPausa } from '@/server/pausa/evaluar'
import { exito, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/** ¿Ya venció la pausa de una conversación tomada por una persona? n8n lo consulta antes de callar. */
export async function evaluarPausaAccion(
  parametros: ParametrosDe<'evaluar_pausa'>,
): Promise<ResultadoAccion<ReturnType<typeof evaluarPausa>>> {
  const ultima = parametros.ultima_persona_en ? new Date(parametros.ultima_persona_en) : null
  return exito(
    evaluarPausa(
      {
        etiquetas: parametros.etiquetas,
        ultimaPersonaEn: ultima && !Number.isNaN(ultima.getTime()) ? ultima : null,
        ahora: new Date(),
      },
      await horarioDelLocal(),
    ),
  )
}
