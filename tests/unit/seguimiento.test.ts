import { describe, expect, it } from 'vitest'
import {
  type ContextoSeleccion,
  claveHecho,
  dentroDelHorario,
  elegirCandidatos,
  type FilaConversacion,
  PASOS,
  pasoDebido,
} from '@/server/seguimiento/elegir'

const AHORA = new Date('2026-10-01T15:00:00Z') // 10:00 en Quito
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60_000).toISOString()

const fila = (minutos: number, sobre: Partial<FilaConversacion> = {}, contexto = {}) =>
  ({
    telefono: '+593990000001',
    chatwoot_conversation_id: 7,
    ultima_interaccion: haceMin(minutos),
    contexto: {
      temperatura: 'tibio',
      necesidad: 'lavar un edredón',
      proxima_accion: 'agendar',
      ultimo_mensaje_cliente: 'cuánto cuesta un edredón',
      ultima_respuesta_agente: 'El edredón le sale en $6,00. ¿Le agendo la recogida?',
      ...contexto,
    },
    ...sobre,
  }) satisfies FilaConversacion

const ctx = (sobre: Partial<ContextoSeleccion> = {}): ContextoSeleccion => ({
  ahora: AHORA,
  equipo: new Set(),
  excluidos: new Set(),
  hechos: new Set(),
  barridos: new Set(),
  textosPrevios: new Map(),
  nombres: new Map(),
  ...sobre,
})

describe('seguimiento: los cuatro pasos de la ventana de 24 h', () => {
  it('toca a los 30 min, a la hora, a las 6 h y a las 23 h 30 min de silencio', () => {
    expect(pasoDebido(30)).toBe(1)
    expect(pasoDebido(60)).toBe(2)
    expect(pasoDebido(360)).toBe(3)
    expect(pasoDebido(23 * 60 + 30)).toBe(4)
  })

  it('antes de los 30 min no toca nada', () => {
    for (const m of [0, 10, 29]) expect(pasoDebido(m)).toBeNull()
  })

  it('un paso que no salió a tiempo sale después: solo el más reciente, nunca varios', () => {
    expect(pasoDebido(50)).toBe(1)
    expect(pasoDebido(90)).toBe(2)
    expect(pasoDebido(400)).toBe(3)
    expect(pasoDebido(1000)).toBe(3)
    expect(pasoDebido(1415)).toBe(4)
  })

  it('el último sale antes de que Meta cierre la ventana (24 h)', () => {
    const ultimo = PASOS[PASOS.length - 1]
    expect(ultimo?.hasta).toBeLessThan(24 * 60)
    expect(pasoDebido(24 * 60)).toBeNull()
    expect(pasoDebido(1434)).toBeNull()
  })

  it('cada margen alcanza para una consulta cada 5 minutos', () => {
    for (const p of PASOS) expect(p.hasta - p.desde).toBeGreaterThanOrEqual(10)
  })
})

describe('seguimiento: a quién se le escribe', () => {
  it('un lead tibio que calló 30 min es candidato y lleva su paso', () => {
    const [c] = elegirCandidatos([fila(32)], ctx())
    expect(c?.paso).toBe(1)
    expect(c?.necesidad).toBe('lavar un edredón')
    expect(elegirCandidatos([fila(62)], ctx())[0]?.paso).toBe(2)
    expect(elegirCandidatos([fila(1412)], ctx())[0]?.paso).toBe(4)
  })

  it('no repite un paso ya hecho en el mismo silencio, pero sí hace el siguiente', () => {
    const f = fila(32)
    const hechos = new Set([claveHecho(f.telefono, 1, f.ultima_interaccion)])
    expect(elegirCandidatos([f], ctx({ hechos }))).toHaveLength(0)
    const segundo = fila(62, { ultima_interaccion: f.ultima_interaccion })
    expect(
      elegirCandidatos([{ ...segundo, ultima_interaccion: haceMin(62) }], ctx({ hechos })),
    ).toHaveLength(1)
  })

  it('si el cliente vuelve a escribir, la cuenta empieza de nuevo', () => {
    const viejo = fila(32)
    const hechos = new Set([claveHecho(viejo.telefono, 1, viejo.ultima_interaccion)])
    // nueva interacción: otra marca de tiempo, otra clave
    const nuevo = fila(31, { ultima_interaccion: haceMin(31) })
    expect(
      elegirCandidatos(
        [nuevo],
        ctx({ hechos: new Set([claveHecho(nuevo.telefono, 1, haceMin(200))]) }),
      ),
    ).toHaveLength(1)
    expect(hechos.size).toBe(1)
  })

  it('un chat de barrido pasa sin el filtro de persona, pero el pedido lo sigue frenando', () => {
    const f = fila(400)
    const barridos = new Set([`${f.telefono}|${new Date(f.ultima_interaccion).getTime()}`])
    expect(elegirCandidatos([f], ctx({ barridos }))[0]?.sin_filtro_persona).toBe(true)
    expect(elegirCandidatos([f], ctx())[0]?.sin_filtro_persona).toBe(false)
    expect(elegirCandidatos([f], ctx({ barridos, excluidos: new Set([f.telefono]) }))).toHaveLength(
      0,
    )
    expect(
      elegirCandidatos([fila(400, {}, { proxima_accion: 'pedido_creado' })], ctx({ barridos })),
    ).toHaveLength(0)
  })

  it('no insiste a quien ya se detectó que contrató, agendó o dijo que no, salvo que vuelva a escribir', () => {
    const f = fila(400)
    const despues = new Date(new Date(f.ultima_interaccion).getTime() + 60_000).toISOString()
    const antes = new Date(new Date(f.ultima_interaccion).getTime() - 60_000).toISOString()
    for (const estado of ['vendido', 'agendado', 'rechazado']) {
      const cerrado = fila(400, {}, { estado_comercial: estado, estado_comercial_en: despues })
      expect(elegirCandidatos([cerrado], ctx())).toHaveLength(0)
    }
    // escribió otra vez después de la detección: se vuelve a evaluar
    const volvio = fila(400, {}, { estado_comercial: 'vendido', estado_comercial_en: antes })
    expect(elegirCandidatos([volvio], ctx())).toHaveLength(1)
  })

  it('pasa a la redacción lo ya enviado, para no repetirse', () => {
    const f = fila(62)
    const textosPrevios = new Map([
      [`${f.telefono}|${new Date(f.ultima_interaccion).getTime()}`, ['¿Pudo ver el precio?']],
    ])
    expect(elegirCandidatos([f], ctx({ textosPrevios }))[0]?.anteriores).toEqual([
      '¿Pudo ver el precio?',
    ])
  })

  it('no molesta al que ya pidió, al escalado, al frío ni al equipo', () => {
    expect(
      elegirCandidatos([fila(32, {}, { proxima_accion: 'pedido_creado' })], ctx()),
    ).toHaveLength(0)
    expect(elegirCandidatos([fila(32, {}, { escalado: true })], ctx())).toHaveLength(0)
    expect(elegirCandidatos([fila(32, {}, { temperatura: 'frio' })], ctx())).toHaveLength(0)
    expect(elegirCandidatos([fila(32)], ctx({ equipo: new Set(['+593990000001']) }))).toHaveLength(
      0,
    )
    expect(
      elegirCandidatos([fila(32)], ctx({ excluidos: new Set(['+593990000001']) })),
    ).toHaveLength(0)
  })

  it('sin conversación de Chatwoot o sin nada que retomar no hay mensaje posible', () => {
    expect(elegirCandidatos([fila(32, { chatwoot_conversation_id: null })], ctx())).toHaveLength(0)
    expect(elegirCandidatos([fila(32, {}, { ultima_respuesta_agente: '' })], ctx())).toHaveLength(0)
  })

  it('el nombre solo sale si el cliente o el CRM lo dieron', () => {
    const con = elegirCandidatos([fila(32)], ctx({ nombres: new Map([['+593990000001', 'Ana']]) }))
    expect(con[0]?.nombre).toBe('Ana')
    expect(elegirCandidatos([fila(32)], ctx())[0]?.nombre).toBeNull()
  })
})

describe('seguimiento: solo en horario del local', () => {
  const config = {
    dias_operacion: [1, 2, 3, 4, 5, 6],
    hora_apertura: '09:00',
    hora_cierre: '19:00',
  }

  it('escribe en horario y no de madrugada, de noche ni en domingo', () => {
    expect(dentroDelHorario(AHORA, config)).toBe(true) // jueves 10:00
    expect(dentroDelHorario(new Date('2026-10-01T11:00:00Z'), config)).toBe(false) // 06:00
    expect(dentroDelHorario(new Date('2026-10-02T00:00:00Z'), config)).toBe(false) // 19:00
    expect(dentroDelHorario(new Date('2026-10-04T15:00:00Z'), config)).toBe(false) // domingo
  })
})
