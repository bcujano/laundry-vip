import { type HorarioLocal, minutosHabiles } from '@/server/avisos-equipo/horario-habil'

/**
 * Pausa de la conversación cuando una persona tomó el chat (etiqueta «humano»).
 * Regla de María Sol (Anexo A, regla 2): la pausa vence a las 3 horas hábiles sin que nadie del
 * equipo escriba, y entonces el agente retoma si el cliente sigue escribiendo. NO vence en los
 * casos delicados: esos solo se devuelven quitando la etiqueta a mano.
 */
export const MINUTOS_HABILES_DE_PAUSA = 180

/** Etiquetas de los 7 casos que nunca retoma solo el agente. */
export const ETIQUETAS_DELICADAS = [
  'reclamo',
  'dinero',
  'empresa',
  'molesto',
  'cobertura',
  'menor',
  'sospechoso',
] as const

export type DecisionPausa = {
  retomar: boolean
  motivo: 'sin_pausa' | 'delicado' | 'vigente' | 'vencida'
  minutos_habiles?: number
}

export function evaluarPausa(
  entrada: { etiquetas: string[]; ultimaPersonaEn?: Date | null; ahora: Date },
  horario: HorarioLocal,
): DecisionPausa {
  const etiquetas = entrada.etiquetas.map((e) => e.toLowerCase())
  if (!etiquetas.includes('humano')) return { retomar: true, motivo: 'sin_pausa' }
  if (ETIQUETAS_DELICADAS.some((e) => etiquetas.includes(e))) {
    return { retomar: false, motivo: 'delicado' }
  }
  // Sin ningún mensaje de una persona a la vista, la etiqueta es vieja: cuenta como vencida.
  if (!entrada.ultimaPersonaEn) return { retomar: true, motivo: 'vencida' }
  const minutos = minutosHabiles(entrada.ultimaPersonaEn, entrada.ahora, horario)
  return minutos >= MINUTOS_HABILES_DE_PAUSA
    ? { retomar: true, motivo: 'vencida', minutos_habiles: minutos }
    : { retomar: false, motivo: 'vigente', minutos_habiles: minutos }
}
