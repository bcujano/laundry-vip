import { describe, expect, it } from 'vitest'
import type { HorarioLocal } from '@/server/avisos-equipo/horario-habil'
import { evaluarPausa } from '@/server/pausa/evaluar'

const HORARIO: HorarioLocal = {
  dias: [1, 2, 3, 4, 5, 6],
  apertura: '09:00',
  cierre: '19:00',
  cierreSabado: '17:00',
}
/** Hora de Quito (UTC-5 fijo). */
const quito = (iso: string) => new Date(`${iso}-05:00`)

describe('pausa de la conversación tomada por una persona (Anexo A, regla 2)', () => {
  it('sin la etiqueta «humano» no hay pausa', () => {
    expect(evaluarPausa({ etiquetas: [], ahora: quito('2026-10-12T10:00') }, HORARIO).motivo).toBe(
      'sin_pausa',
    )
  })

  it('vence a las 3 horas hábiles sin que nadie escriba', () => {
    const ultima = quito('2026-10-12T09:30') // lunes
    const antes = evaluarPausa(
      { etiquetas: ['humano'], ultimaPersonaEn: ultima, ahora: quito('2026-10-12T12:00') },
      HORARIO,
    )
    expect(antes).toMatchObject({ retomar: false, motivo: 'vigente', minutos_habiles: 150 })
    const despues = evaluarPausa(
      { etiquetas: ['humano'], ultimaPersonaEn: ultima, ahora: quito('2026-10-12T12:31') },
      HORARIO,
    )
    expect(despues).toMatchObject({ retomar: true, motivo: 'vencida' })
  })

  it('las horas de la noche y del domingo no cuentan', () => {
    // sábado 16:30 → quedan 30 min hábiles ese día; el domingo no cuenta; lunes 9:00-11:30 son 150 más
    const ultima = quito('2026-10-10T16:30')
    expect(
      evaluarPausa(
        { etiquetas: ['humano'], ultimaPersonaEn: ultima, ahora: quito('2026-10-12T10:00') },
        HORARIO,
      ).retomar,
    ).toBe(false)
    expect(
      evaluarPausa(
        { etiquetas: ['humano'], ultimaPersonaEn: ultima, ahora: quito('2026-10-12T11:31') },
        HORARIO,
      ).retomar,
    ).toBe(true)
  })

  it('en los casos delicados nunca vence sola', () => {
    for (const etiqueta of [
      'reclamo',
      'dinero',
      'empresa',
      'molesto',
      'cobertura',
      'menor',
      'sospechoso',
    ]) {
      const r = evaluarPausa(
        {
          etiquetas: ['humano', etiqueta],
          ultimaPersonaEn: quito('2026-10-01T10:00'),
          ahora: quito('2026-10-12T10:00'),
        },
        HORARIO,
      )
      expect(r).toMatchObject({ retomar: false, motivo: 'delicado' })
    }
  })

  it('una etiqueta vieja sin mensajes de personas a la vista cuenta como vencida', () => {
    expect(
      evaluarPausa({ etiquetas: ['humano'], ahora: quito('2026-10-12T10:00') }, HORARIO),
    ).toMatchObject({
      retomar: true,
      motivo: 'vencida',
    })
  })
})
