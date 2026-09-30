import { describe, expect, it } from 'vitest'
import {
  type ContextoSeleccion,
  dentroDelHorario,
  elegirCandidatos,
  type FilaConversacion,
} from '@/server/seguimiento/elegir'

const AHORA = new Date('2026-10-01T15:00:00Z') // 10:00 en Quito
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()

const fila = (sobre: Partial<FilaConversacion> = {}, contexto = {}): FilaConversacion => ({
  telefono: '+593990000001',
  chatwoot_conversation_id: 7,
  ultima_interaccion: haceHoras(5),
  contexto: {
    temperatura: 'tibio',
    necesidad: 'lavar un edredón',
    proxima_accion: 'agendar',
    ultimo_mensaje_cliente: 'cuánto cuesta un edredón',
    ultima_respuesta_agente: 'El edredón le sale en $6,00. ¿Le agendo la recogida?',
    ...contexto,
  },
  ...sobre,
})

const ctx = (sobre: Partial<ContextoSeleccion> = {}): ContextoSeleccion => ({
  ahora: AHORA,
  equipo: new Set(),
  excluidos: new Set(),
  nombres: new Map(),
  ...sobre,
})

describe('seguimiento: a quién se le escribe', () => {
  it('un lead tibio que calló hace 5 h es candidato', () => {
    const [c] = elegirCandidatos([fila()], ctx())
    expect(c?.telefono).toBe('+593990000001')
    expect(c?.necesidad).toBe('lavar un edredón')
  })

  it('respeta la ventana: ni muy pronto ni fuera de las 24 h de Meta', () => {
    expect(elegirCandidatos([fila({ ultima_interaccion: haceHoras(1) })], ctx())).toHaveLength(0)
    expect(elegirCandidatos([fila({ ultima_interaccion: haceHoras(22) })], ctx())).toHaveLength(0)
  })

  it('no molesta al que ya pidió, al escalado, al frío ni al equipo', () => {
    expect(elegirCandidatos([fila({}, { proxima_accion: 'pedido_creado' })], ctx())).toHaveLength(0)
    expect(elegirCandidatos([fila({}, { escalado: true })], ctx())).toHaveLength(0)
    expect(elegirCandidatos([fila({}, { temperatura: 'frio' })], ctx())).toHaveLength(0)
    expect(elegirCandidatos([fila()], ctx({ equipo: new Set(['+593990000001']) }))).toHaveLength(0)
    expect(elegirCandidatos([fila()], ctx({ excluidos: new Set(['+593990000001']) }))).toHaveLength(
      0,
    )
  })

  it('sin conversación de Chatwoot o sin nada que retomar no hay mensaje posible', () => {
    expect(elegirCandidatos([fila({ chatwoot_conversation_id: null })], ctx())).toHaveLength(0)
    expect(elegirCandidatos([fila({}, { ultima_respuesta_agente: '' })], ctx())).toHaveLength(0)
  })

  it('el nombre solo sale si el cliente o el CRM lo dieron', () => {
    const con = elegirCandidatos([fila()], ctx({ nombres: new Map([['+593990000001', 'Ana']]) }))
    expect(con[0]?.nombre).toBe('Ana')
    expect(elegirCandidatos([fila()], ctx())[0]?.nombre).toBeNull()
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
    expect(dentroDelHorario(new Date('2026-10-01T23:30:00Z'), config)).toBe(false) // 18:30: queda menos de una hora
    expect(dentroDelHorario(new Date('2026-10-04T15:00:00Z'), config)).toBe(false) // domingo
  })
})
