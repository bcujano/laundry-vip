/**
 * Plazo de entrega por servicio. Lo fija María Sol en el CRM (columna `plazo_horas`)
 * y cuenta desde que la ropa llega a planta, sin domingos ni feriados.
 */

const HORAS_SEMANA_HABIL = 168

/** Cómo se le dice al cliente: «24 horas», «72 horas», «1 semana hábil». */
export function plazoLegible(horas: number): string {
  if (horas === HORAS_SEMANA_HABIL) return '1 semana hábil'
  return `${horas} horas`
}

/** El plazo que cubre a todos: el más largo. */
export function plazoMayor(horas: number[]): number | null {
  return horas.length === 0 ? null : Math.max(...horas)
}

/**
 * Plazo habitual de cada método de lavado, para responder «¿cuánto demora?» antes de
 * cotizar. Es el más frecuente del método (las alfombras, que son agua pero tardan una
 * semana, no deciden por la ropa de diario); si empatan, el más corto.
 */
export function plazosPorMetodo(
  filas: { metodo: string; plazo_horas: number }[],
): Record<string, string> {
  const porMetodo = new Map<string, Map<number, number>>()
  for (const { metodo, plazo_horas } of filas) {
    const conteo = porMetodo.get(metodo) ?? new Map<number, number>()
    conteo.set(plazo_horas, (conteo.get(plazo_horas) ?? 0) + 1)
    porMetodo.set(metodo, conteo)
  }
  const resultado: Record<string, string> = {}
  for (const [metodo, conteo] of porMetodo) {
    const [mejor] = [...conteo.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
    if (mejor) resultado[metodo] = plazoLegible(mejor[0])
  }
  return resultado
}
