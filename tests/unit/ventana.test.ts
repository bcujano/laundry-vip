import { describe, expect, it } from 'vitest'
import { obtenerProximaVentana, ultimaHoraDelDia } from '@/server/scheduling/ventana'

/** Horario real: lunes a sábado, recolección 08:00–12:00, margen 30 minutos. */
const HORARIO = {
  diasOperacion: [1, 2, 3, 4, 5, 6],
  horaInicio: '08:00',
  horaFin: '12:00',
  margenMinutos: 30,
}

/** Construye un instante a partir de la hora local de Quito (UTC-5 fijo). */
function enQuito(iso: string): Date {
  return new Date(`${iso}-05:00`)
}

/** Devuelve 'YYYY-MM-DD HH:MM' en hora de Quito, para aserciones legibles. */
function comoQuito(fecha: Date): string {
  const local = new Date(fecha.getTime() - 5 * 60 * 60 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())} ${p(local.getUTCHours())}:${p(local.getUTCMinutes())}`
}

describe('obtenerProximaVentana', () => {
  it('de madrugada un día laborable ofrece la apertura de ese mismo día', () => {
    // Martes 2026-09-15, 02:00.
    const ventana = obtenerProximaVentana(enQuito('2026-09-15T02:00'), HORARIO)
    expect(comoQuito(ventana.inicio)).toBe('2026-09-15 08:00')
    expect(comoQuito(ventana.fin)).toBe('2026-09-15 12:00')
    expect(ventana.esHoy).toBe(true)
  })

  it('a media mañana respeta el margen de 30 minutos', () => {
    const ventana = obtenerProximaVentana(enQuito('2026-09-15T10:00'), HORARIO)
    expect(comoQuito(ventana.inicio)).toBe('2026-09-15 10:30')
    expect(ventana.esHoy).toBe(true)
  })

  it('a las 11:30 clavadas todavía alcanza para hoy', () => {
    const ventana = obtenerProximaVentana(enQuito('2026-09-15T11:30'), HORARIO)
    expect(comoQuito(ventana.inicio)).toBe('2026-09-15 12:00')
    expect(ventana.esHoy).toBe(true)
  })

  it('la ventana de hoy empieza en hora redonda, no en «13:41»', () => {
    // 09:10 + 30 min de margen = 09:40 → se le dice al cliente «desde las 10:00».
    const ventana = obtenerProximaVentana(enQuito('2026-09-15T09:10'), HORARIO)
    expect(comoQuito(ventana.inicio)).toBe('2026-09-15 10:00')
  })

  it('una hora que ya es redonda no se mueve', () => {
    const ventana = obtenerProximaVentana(enQuito('2026-09-15T09:00'), HORARIO)
    expect(comoQuito(ventana.inicio)).toBe('2026-09-15 09:30')
  })

  it('al final del día, si redondear se come la ventana, vale el minuto exacto', () => {
    // 11:20 + 30 = 11:50 → redondear daría 12:00, que es el cierre: mejor
    // «de 11:50 a 12:00» que perder la ventana de hoy.
    const ventana = obtenerProximaVentana(enQuito('2026-09-15T11:20'), HORARIO)
    expect(comoQuito(ventana.inicio)).toBe('2026-09-15 11:50')
    expect(ventana.esHoy).toBe(true)
  })

  it('un minuto más tarde ya salta al día siguiente', () => {
    const ventana = obtenerProximaVentana(enQuito('2026-09-15T11:31'), HORARIO)
    expect(comoQuito(ventana.inicio)).toBe('2026-09-16 08:00')
    expect(ventana.esHoy).toBe(false)
  })

  it('después del cierre pasa al día siguiente', () => {
    const ventana = obtenerProximaVentana(enQuito('2026-09-15T18:45'), HORARIO)
    expect(comoQuito(ventana.inicio)).toBe('2026-09-16 08:00')
  })

  it('un domingo a las 2 de la mañana ofrece el lunes, nunca rechaza', () => {
    // 2026-09-20 es domingo.
    const ventana = obtenerProximaVentana(enQuito('2026-09-20T02:00'), HORARIO)
    expect(comoQuito(ventana.inicio)).toBe('2026-09-21 08:00')
    expect(ventana.esHoy).toBe(false)
  })

  it('un sábado por la tarde salta el domingo y cae en lunes', () => {
    // 2026-09-19 es sábado.
    const ventana = obtenerProximaVentana(enQuito('2026-09-19T16:00'), HORARIO)
    expect(comoQuito(ventana.inicio)).toBe('2026-09-21 08:00')
  })

  it('la ventana siempre queda en el futuro, a cualquier hora del día', () => {
    for (let dia = 14; dia <= 21; dia++) {
      for (let hora = 0; hora < 24; hora++) {
        const ahora = enQuito(`2026-09-${dia}T${String(hora).padStart(2, '0')}:17`)
        const ventana = obtenerProximaVentana(ahora, HORARIO)
        expect(ventana.inicio.getTime()).toBeGreaterThan(ahora.getTime())
        expect(ventana.fin.getTime()).toBeGreaterThan(ventana.inicio.getTime())
      }
    }
  })

  it('cruza el fin de mes sin romperse', () => {
    const ventana = obtenerProximaVentana(enQuito('2026-09-30T20:00'), HORARIO)
    expect(comoQuito(ventana.inicio)).toBe('2026-10-01 08:00')
  })

  it('con un solo día laborable espera hasta la semana siguiente', () => {
    const soloMiercoles = { ...HORARIO, diasOperacion: [3] }
    // 2026-09-17 es jueves.
    const ventana = obtenerProximaVentana(enQuito('2026-09-17T09:00'), soloMiercoles)
    expect(comoQuito(ventana.inicio)).toBe('2026-09-23 08:00')
  })

  it('falla claro si la configuración no tiene días de operación', () => {
    expect(() => obtenerProximaVentana(new Date(), { ...HORARIO, diasOperacion: [] })).toThrow(
      /ningún día de operación/,
    )
  })

  it('falla claro si el cierre no es posterior a la apertura', () => {
    expect(() =>
      obtenerProximaVentana(new Date(), { ...HORARIO, horaInicio: '12:00', horaFin: '08:00' }),
    ).toThrow(/posterior/)
  })
})

describe('ultimaHoraDelDia', () => {
  it('con cierre 12:00 y margen 30 la última orden es a las 11:30', () => {
    expect(ultimaHoraDelDia(HORARIO)).toBe('11:30')
  })
})

describe('almuerzo y ventanas de duración fija (cuestionario de Sol)', () => {
  const CON_ALMUERZO = {
    diasOperacion: [1, 2, 3, 4, 5],
    horaInicio: '09:00',
    horaFin: '17:00',
    margenMinutos: 60,
    almuerzoInicio: '14:00',
    almuerzoFin: '15:00',
    duracionMinutos: 120,
  }

  it('la ventana dura 2 horas', () => {
    const v = obtenerProximaVentana(enQuito('2026-09-15T08:00'), CON_ALMUERZO)
    expect([comoQuito(v.inicio), comoQuito(v.fin)]).toEqual([
      '2026-09-15 09:00',
      '2026-09-15 11:00',
    ])
  })

  it('una ventana que cruzaría el almuerzo empieza al reabrir', () => {
    const v = obtenerProximaVentana(enQuito('2026-09-15T12:30'), CON_ALMUERZO)
    expect([comoQuito(v.inicio), comoQuito(v.fin)]).toEqual([
      '2026-09-15 15:00',
      '2026-09-15 17:00',
    ])
  })

  it('nunca empieza dentro del almuerzo', () => {
    const v = obtenerProximaVentana(enQuito('2026-09-15T13:10'), CON_ALMUERZO)
    expect(comoQuito(v.inicio)).toBe('2026-09-15 15:00')
  })

  it('si la ventana de 2 horas ya no cabe hoy, pasa al día siguiente', () => {
    const v = obtenerProximaVentana(enQuito('2026-09-15T15:30'), CON_ALMUERZO)
    expect([comoQuito(v.inicio), comoQuito(v.fin)]).toEqual([
      '2026-09-16 09:00',
      '2026-09-16 11:00',
    ])
  })

  it('sin almuerzo ni duración todo sigue como antes', () => {
    const v = obtenerProximaVentana(enQuito('2026-09-15T02:00'), HORARIO)
    expect(comoQuito(v.fin)).toBe('2026-09-15 12:00')
  })
})
