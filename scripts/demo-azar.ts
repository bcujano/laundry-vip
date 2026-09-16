// Pseudoaleatorio con semilla: cada corrida genera exactamente lo mismo.
let semilla = 20260916
export function azar(): number {
  semilla = (semilla + 0x6d2b79f5) | 0
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
export const entre = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1))
export const redondear = (n: number) => Math.round(n * 100) / 100
