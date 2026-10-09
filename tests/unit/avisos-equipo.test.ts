import { describe, expect, it } from 'vitest'
import {
  estaAbierto,
  frasePlazoHumano,
  type HorarioLocal,
  minutosHabiles,
} from '@/server/avisos-equipo/horario-habil'
import { accionDeAviso } from '@/server/avisos-equipo/repo'
import { etiquetaDe, parametroPlantilla } from '@/server/avisos-equipo/tipos'

/** Un local cualquiera: la lógica no puede depender de VIP Laundry (el sistema se vende a otras). */
const LOCAL: HorarioLocal = {
  dias: [1, 2, 3, 4, 5, 6],
  apertura: '09:00',
  cierre: '19:00',
  cierreSabado: '17:00',
}

/** Hora de Quito (UTC-5) → instante. 2026-10-05 es lunes. */
const quito = (dia: number, hhmm: string) =>
  new Date(`2026-10-${String(dia).padStart(2, '0')}T${hhmm}:00-05:00`)

describe('horario hábil (cualquier local)', () => {
  it('abierto entre semana en horario, cerrado de noche, sábado tarde y domingo', () => {
    expect(estaAbierto(quito(5, '10:00'), LOCAL)).toBe(true)
    expect(estaAbierto(quito(5, '19:00'), LOCAL)).toBe(false)
    expect(estaAbierto(quito(5, '08:59'), LOCAL)).toBe(false)
    expect(estaAbierto(quito(10, '16:59'), LOCAL)).toBe(true)
    expect(estaAbierto(quito(10, '17:00'), LOCAL)).toBe(false)
    expect(estaAbierto(quito(11, '12:00'), LOCAL)).toBe(false)
  })

  it('cuenta solo minutos con el local abierto', () => {
    expect(minutosHabiles(quito(5, '10:00'), quito(5, '10:45'), LOCAL)).toBe(45)
    // de lunes 18:30 a martes 09:30: 30 min de la tarde + 30 min de la mañana
    expect(minutosHabiles(quito(5, '18:30'), quito(6, '09:30'), LOCAL)).toBe(60)
    // sábado 16:30 a lunes 09:30: 30 min del sábado + 30 min del lunes
    expect(minutosHabiles(quito(10, '16:30'), quito(12, '09:30'), LOCAL)).toBe(60)
    expect(minutosHabiles(quito(5, '12:00'), quito(5, '11:00'), LOCAL)).toBe(0)
  })
})

describe('plazo de respuesta humana que se le promete al cliente (nunca «pronto»)', () => {
  it('con el local abierto: en unos 30 minutos', () => {
    expect(frasePlazoHumano(quito(5, '10:00'), LOCAL)).toBe('en unos 30 minutos')
  })

  it('de noche: mañana a partir de la apertura', () => {
    expect(frasePlazoHumano(quito(5, '21:00'), LOCAL)).toBe('mañana a partir de las 9:00')
  })

  it('antes de abrir el mismo día: hoy a partir de la apertura', () => {
    expect(frasePlazoHumano(quito(6, '07:30'), LOCAL)).toBe('hoy a partir de las 9:00')
  })

  it('sábado después del cierre y domingo: el lunes', () => {
    expect(frasePlazoHumano(quito(10, '18:00'), LOCAL)).toBe('el lunes a partir de las 9:00')
    expect(frasePlazoHumano(quito(11, '11:00'), LOCAL)).toBe('el lunes a partir de las 9:00')
  })

  it('un local que no abre los sábados salta al lunes desde el viernes de noche', () => {
    const lunesAViernes = { ...LOCAL, dias: [1, 2, 3, 4, 5] }
    expect(frasePlazoHumano(quito(9, '20:00'), lunesAViernes)).toBe('el lunes a partir de las 9:00')
  })
})

describe('reintento del aviso al equipo', () => {
  const horario = LOCAL
  it('un aviso nuevo se envía; uno enviado espera 30 minutos hábiles y se repite una vez', () => {
    const enviado = quito(5, '10:00').toISOString()
    expect(
      accionDeAviso({ estado: 'pendiente', enviado_en: null }, quito(5, '10:00'), horario),
    ).toBe('enviar')
    expect(
      accionDeAviso({ estado: 'enviado', enviado_en: enviado }, quito(5, '10:29'), horario),
    ).toBe('esperar')
    expect(
      accionDeAviso({ estado: 'enviado', enviado_en: enviado }, quito(5, '10:30'), horario),
    ).toBe('reintentar')
    // ya reintentado o atendido: no se vuelve a mandar
    expect(
      accionDeAviso({ estado: 'reintentado', enviado_en: enviado }, quito(5, '15:00'), horario),
    ).toBe('esperar')
    expect(
      accionDeAviso({ estado: 'atendido', enviado_en: enviado }, quito(5, '15:00'), horario),
    ).toBe('esperar')
  })

  it('un aviso de noche no se repite hasta que pasen 30 minutos con el local abierto', () => {
    const enviado = quito(5, '20:00').toISOString()
    expect(
      accionDeAviso({ estado: 'enviado', enviado_en: enviado }, quito(6, '09:20'), horario),
    ).toBe('esperar')
    expect(
      accionDeAviso({ estado: 'enviado', enviado_en: enviado }, quito(6, '09:30'), horario),
    ).toBe('reintentar')
  })
})

describe('texto del aviso', () => {
  it('un tipo desconocido cae en «otro» y los parámetros de Meta no llevan saltos de línea', () => {
    expect(etiquetaDe('inventado')).toBe('Otro caso')
    expect(etiquetaDe('reclamo')).toBe('Reclamo o daño')
    expect(parametroPlantilla('línea uno\n\nlínea   dos\t fin')).toBe('línea uno línea dos fin')
    expect(parametroPlantilla('x'.repeat(500)).length).toBe(400)
  })
})
