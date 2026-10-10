import type { Configuracion } from '@/types/database'

/**
 * El horario del local en una frase, como lo diría la dueña: «lunes a viernes
 * de 09:00 a 19:00 y sábados de 09:00 a 17:00».
 *
 * El agente le decía al cliente un horario que no era el suyo. Ahora lo lee de
 * Configuración en cada mensaje, y el sábado se trata aparte porque se cierra
 * más temprano.
 */

const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

const hhmm = (hora: string) => hora.slice(0, 5)

/** «lunes a viernes» si son seguidos; «lunes, miércoles y viernes» si no. */
function tramo(dias: number[]): string {
  if (dias.length === 0) return ''
  const nombres = dias.map((dia) => NOMBRES[dia - 1] as string)
  if (dias.length === 1) return nombres[0] as string

  const seguidos = dias.every((dia, i) => i === 0 || dia === (dias[i - 1] as number) + 1)
  if (seguidos) return `${nombres[0]} a ${nombres[nombres.length - 1]}`
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

export function horarioLegible(config: Configuracion): string {
  const dias = [...new Set(config.dias_operacion)].sort((a, b) => a - b)
  const entreSemana = dias.filter((dia) => dia <= 5)
  const sabado = dias.includes(6)
  const domingo = dias.includes(7)

  const partes: string[] = []
  if (entreSemana.length > 0) {
    partes.push(
      `${tramo(entreSemana)} de ${hhmm(config.hora_apertura)} a ${hhmm(config.hora_cierre)}`,
    )
  }
  if (sabado) {
    partes.push(`sábados de ${hhmm(config.hora_apertura)} a ${hhmm(config.hora_cierre_sabado)}`)
  }
  if (domingo) {
    partes.push(`domingos de ${hhmm(config.hora_apertura)} a ${hhmm(config.hora_cierre_sabado)}`)
  }

  const horario = partes.join(' y ')
  if (config.almuerzo_inicio && config.almuerzo_fin) {
    return `${horario} (cerrado al almuerzo de ${hhmm(config.almuerzo_inicio)} a ${hhmm(config.almuerzo_fin)})`
  }
  return horario
}
