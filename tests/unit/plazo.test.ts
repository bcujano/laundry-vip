import { describe, expect, it } from 'vitest'
import { plazoLegible, plazoMayor, plazosPorMetodo } from '@/server/pricing/plazo'

describe('plazo de entrega por servicio (María Sol, 2026-10)', () => {
  it('lo dice como se le dice al cliente', () => {
    expect(plazoLegible(24)).toBe('24 horas')
    expect(plazoLegible(72)).toBe('72 horas')
    expect(plazoLegible(168)).toBe('1 semana hábil')
  })

  it('el plazo que cubre una cotización mixta es el más largo', () => {
    expect(plazoMayor([24, 72, 24])).toBe(72)
    expect(plazoMayor([])).toBeNull()
  })

  it('el plazo habitual de un método es el más frecuente: las alfombras no deciden por la ropa de diario', () => {
    const filas = [
      { metodo: 'agua', plazo_horas: 24 },
      { metodo: 'agua', plazo_horas: 24 },
      { metodo: 'agua', plazo_horas: 168 },
      { metodo: 'seco', plazo_horas: 72 },
    ]
    expect(plazosPorMetodo(filas)).toEqual({ agua: '24 horas', seco: '72 horas' })
  })

  it('si empatan, el más corto', () => {
    expect(
      plazosPorMetodo([
        { metodo: 'agua', plazo_horas: 72 },
        { metodo: 'agua', plazo_horas: 24 },
      ]),
    ).toEqual({ agua: '24 horas' })
  })
})
