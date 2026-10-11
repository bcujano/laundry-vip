import { listarPoliticas, obtenerPolitica } from '@/server/configuracion/politicas'
import { exito, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/**
 * El agente consulta una política del negocio (promociones, vacaciones, ropa no retirada...). Si la
 * política no tiene regla escrita o la decide el equipo, la respuesta lo dice: el agente no
 * inventa nada y deriva con la frase guía. Sin tema, devuelve la lista de temas disponibles.
 */
export async function consultarPolitica(
  parametros: ParametrosDe<'consultar_politica'>,
): Promise<ResultadoAccion<unknown>> {
  const tema = parametros?.tema?.trim().toLowerCase().replaceAll(' ', '_') ?? ''
  const politica = tema === '' ? null : await obtenerPolitica(tema)

  if (!politica) {
    const temas = (await listarPoliticas()).filter((p) => p.activa).map((p) => p.tema)
    return exito({
      encontrada: false,
      temas_disponibles: temas,
      instruccion:
        'No hay una política con ese nombre. Si el tema no está en la lista, dile al cliente que lo confirmas con el equipo; no inventes nada.',
    })
  }

  const sinRegla = politica.regla.trim() === ''
  return exito({
    encontrada: true,
    tema: politica.tema,
    titulo: politica.titulo,
    regla: sinRegla ? null : politica.regla,
    lo_decide: politica.quien_decide,
    plazo_respuesta: politica.plazo_respuesta || null,
    frase_guia: politica.frase_guia || null,
    instruccion:
      sinRegla || politica.quien_decide !== 'agente'
        ? 'Esto no lo resuelves tú: usa la frase guía (con tus palabras) y ofrece que lo confirme una persona del equipo. No afirmes nada más.'
        : 'Puedes responder con la regla, sin agregar condiciones ni cifras que no estén en ella.',
  })
}
