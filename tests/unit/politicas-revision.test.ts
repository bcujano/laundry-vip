import { describe, expect, it } from 'vitest'
import { requiereRevisionDelEquipo } from '@/server/pedidos/revision'

describe('pedido grande: lo confirma el equipo (fase 3 del cuestionario de Sol)', () => {
  it('30 prendas o más, o $100 o más, piden revisión', () => {
    expect(requiereRevisionDelEquipo([{ cantidad: 29 }], 50)).toBe(false)
    expect(requiereRevisionDelEquipo([{ cantidad: 20 }, { cantidad: 10 }], 50)).toBe(true)
    expect(requiereRevisionDelEquipo([{ cantidad: 3 }], 99.99)).toBe(false)
    expect(requiereRevisionDelEquipo([{ cantidad: 3 }], 100)).toBe(true)
    expect(requiereRevisionDelEquipo([{ cantidad: 3 }], null)).toBe(false)
  })
})
