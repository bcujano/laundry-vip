/**
 * Un pedido grande no se da por cerrado solo con el agente: el equipo lo revisa y lo confirma
 * (cuestionario de Sol, fase 3: umbral de 30 prendas o $100). El pedido queda creado, pero se
 * avisa al equipo y el agente le dice al cliente que una persona lo confirma.
 */
export const UMBRAL_PRENDAS = 30
export const UMBRAL_MONTO_USD = 100

export function requiereRevisionDelEquipo(
  items: { cantidad: number }[],
  montoEstimado: number | null,
): boolean {
  const prendas = items.reduce((suma, item) => suma + item.cantidad, 0)
  return prendas >= UMBRAL_PRENDAS || Number(montoEstimado ?? 0) >= UMBRAL_MONTO_USD
}
