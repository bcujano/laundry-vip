import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { guardarPolitica, listarPoliticas } from '@/server/configuracion/politicas'
import { consultarPolitica } from '@/server/webhook/handlers/politicas'
import { corrida } from '../util/corrida.ts'

const TEMA = `prueba_${corrida()}`
let id = ''

async function consultar(tema?: string) {
  const r = (await consultarPolitica({ tema })) as { ok: true; data: Record<string, unknown> }
  return r.data
}

afterAll(async () => {
  await supabaseAdmin().from('politicas').delete().eq('tema', TEMA)
})

describe('políticas que consulta el agente', () => {
  it('las políticas de Sol vienen escritas con sus respuestas y lo delicado deriva a una persona', async () => {
    const todas = await listarPoliticas()
    const temas = todas.map((p) => p.tema)
    expect(temas).toEqual(
      expect.arrayContaining(['promociones', 'perdida_o_dano', 'formas_de_pago']),
    )

    // Pérdida o daño: lo decide la dueña, el agente no promete ni niega compensación.
    const dano = await consultar('perdida_o_dano')
    expect(dano.encontrada).toBe(true)
    expect(String(dano.regla)).toContain('nunca el agente')
    expect(String(dano.instruccion)).toContain('Esto no lo resuelves tú')
    // y no se filtra al cliente ningún tope de compensación
    expect(String(dano.regla)).toContain('No menciones topes')

    // Formas de pago: la regla la puede decir el agente, sin datos bancarios.
    const pago = await consultar('formas_de_pago')
    expect(String(pago.regla)).toContain('DEUNA')
    expect(String(pago.instruccion)).toContain('Puedes responder con la regla')
  })

  it('una política con regla y decide el agente se puede responder; si la decide una persona, se deriva', async () => {
    const { data, error } = await supabaseAdmin()
      .from('politicas')
      .insert({ tema: TEMA, titulo: 'Prueba', quien_decide: 'equipo' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    id = data.id

    const ok = await guardarPolitica(id, {
      regla: 'Regla de prueba.',
      quien_decide: 'agente',
      plazo_respuesta: '',
      frase_guia: 'Frase de prueba.',
      activa: true,
    })
    expect(ok.ok).toBe(true)
    const respondible = await consultar(TEMA.toUpperCase())
    expect(respondible.regla).toBe('Regla de prueba.')
    expect(String(respondible.instruccion)).toContain('Puedes responder con la regla')

    await guardarPolitica(id, {
      regla: 'Regla de prueba.',
      quien_decide: 'duena',
      plazo_respuesta: 'hoy',
      frase_guia: 'Frase de prueba.',
      activa: true,
    })
    const derivada = await consultar(TEMA)
    expect(String(derivada.instruccion)).toContain('Esto no lo resuelves tú')
  })

  it('una política desactivada o un tema que no existe devuelven la lista de temas, sin inventar', async () => {
    await guardarPolitica(id, {
      regla: 'x',
      quien_decide: 'agente',
      plazo_respuesta: '',
      frase_guia: '',
      activa: false,
    })
    const apagada = await consultar(TEMA)
    expect(apagada.encontrada).toBe(false)
    expect(apagada.temas_disponibles).not.toContain(TEMA)
    expect((await consultar('tema_que_no_existe')).encontrada).toBe(false)
    expect((await consultar()).encontrada).toBe(false)
  })
})
