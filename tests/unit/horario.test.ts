import { describe, expect, it } from 'vitest'
import { horarioLegible } from '@/server/configuracion/horario'
import type { Configuracion } from '@/types/database'

/**
 * El agente le decía al cliente un horario que no era el del local. Ahora lo
 * arma con lo que hay en Configuración, y el sábado va aparte porque se cierra
 * más temprano: así lo dicta la dueña.
 */
const base = {
  hora_apertura: '09:00:00',
  hora_cierre: '19:00:00',
  hora_cierre_sabado: '17:00:00',
} as Configuracion

const con = (dias: number[]) => horarioLegible({ ...base, dias_operacion: dias } as Configuracion)

describe('el horario en palabras', () => {
  it('lunes a sábado dice el sábado aparte', () => {
    expect(con([1, 2, 3, 4, 5, 6])).toBe(
      'lunes a viernes de 09:00 a 19:00 y sábados de 09:00 a 17:00',
    )
  })

  it('sin sábado no lo menciona', () => {
    expect(con([1, 2, 3, 4, 5])).toBe('lunes a viernes de 09:00 a 19:00')
  })

  it('días sueltos se enumeran, no se inventa un rango', () => {
    expect(con([1, 3, 5])).toBe('lunes, miércoles y viernes de 09:00 a 19:00')
  })

  it('un solo día se dice en singular', () => {
    expect(con([6])).toBe('sábados de 09:00 a 17:00')
  })
})
