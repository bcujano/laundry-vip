/**
 * Tipos de aviso del agente al equipo. La clave viaja en la base; la etiqueta es lo que
 * lee la persona. El agente nunca inventa un tipo: los que no reconoce caen en `otro`.
 */
export const TIPOS_AVISO = {
  escalada: 'Cliente pide una persona',
  reclamo: 'Reclamo o daño',
  dinero: 'Pago, comprobante o monto',
  empresa: 'Posible cliente empresarial',
  cobertura: 'Cobertura o excepción de zona',
  logistica: 'Recogida o entrega',
  pedido_borrador: 'Pedido por confirmar',
  venta_sin_pedido: 'Venta cerrada sin pedido en el CRM',
  sospechoso: 'Pedido o mensaje sospechoso',
  cuidado: 'Caso que requiere cuidado',
  otro: 'Otro caso',
} as const

export type TipoAviso = keyof typeof TIPOS_AVISO

export function etiquetaDe(tipo: string): string {
  return TIPOS_AVISO[tipo as TipoAviso] ?? TIPOS_AVISO.otro
}

/** Meta no admite saltos de línea, tabulaciones ni cuatro espacios en un parámetro de plantilla. */
export function parametroPlantilla(texto: string, max = 400): string {
  return texto.replace(/\s+/g, ' ').trim().slice(0, max)
}
