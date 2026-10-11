import { describe, expect, it } from 'vitest'
import {
  diasEntre,
  PASOS_REACTIVACION,
  PASOS_ROPA,
  pasoPendiente,
} from '@/server/plantillas/candidatos'

describe('plantillas automáticas: qué paso toca', () => {
  it('cuenta días enteros', () => {
    expect(diasEntre(new Date('2026-09-01T10:00:00Z'), new Date('2026-10-01T09:59:00Z'))).toBe(29)
    expect(diasEntre(new Date('2026-09-01T10:00:00Z'), new Date('2026-10-01T10:00:00Z'))).toBe(30)
  })

  it('reactivación: a los 30 días el primero, a los 90 el segundo, y no repite', () => {
    expect(pasoPendiente(29, PASOS_REACTIVACION, new Set())).toBeNull()
    expect(pasoPendiente(30, PASOS_REACTIVACION, new Set())).toBe(30)
    expect(pasoPendiente(45, PASOS_REACTIVACION, new Set([30]))).toBeNull()
    expect(pasoPendiente(90, PASOS_REACTIVACION, new Set([30]))).toBe(90)
    expect(pasoPendiente(200, PASOS_REACTIVACION, new Set([30, 90]))).toBeNull()
  })

  it('ropa no retirada: 7, 30, 60 y 80 días; un paso atrasado sale una sola vez, el más alto', () => {
    expect(pasoPendiente(6, PASOS_ROPA, new Set())).toBeNull()
    expect(pasoPendiente(7, PASOS_ROPA, new Set())).toBe(7)
    expect(pasoPendiente(35, PASOS_ROPA, new Set([7]))).toBe(30)
    // pasó de 7 a 65 días sin avisar: sale el de 60, no los tres seguidos
    expect(pasoPendiente(65, PASOS_ROPA, new Set())).toBe(60)
    expect(pasoPendiente(85, PASOS_ROPA, new Set([7, 30, 60]))).toBe(80)
    expect(pasoPendiente(85, PASOS_ROPA, new Set([7, 30, 60, 80]))).toBeNull()
  })
})
