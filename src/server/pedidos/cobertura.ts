import { normalizar } from '@/server/pricing/normalizar'

/**
 * Cobertura verificable. Si el dueño cargó la lista de sectores dentro del
 * radio, una recogida solo se agenda en uno de ellos; con la lista vacía la
 * cobertura no se verifica (el agente solo la conoce como frase).
 */
export type VeredictoSector = 'sin_verificar' | 'dentro' | 'fuera' | 'falta_sector'

const MINIMO = 3

export function verificarSector(sector: string | undefined, sectores: string[]): VeredictoSector {
  const lista = sectores.map(normalizar).filter((s) => s.length >= MINIMO)
  if (lista.length === 0) return 'sin_verificar'

  const dado = normalizar(sector ?? '')
  if (dado.length < MINIMO) return 'falta_sector'

  // «Sector La Kennedy» debe encontrar «kennedy», y «Kennedy Alta» a «kennedy».
  return lista.some((s) => dado.includes(s) || s.includes(dado)) ? 'dentro' : 'fuera'
}
