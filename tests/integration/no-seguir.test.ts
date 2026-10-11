import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { noSeguir } from '@/server/webhook/handlers/no-seguir'
import { corrida } from '../util/corrida.ts'

const TELEFONO = `+5939${corrida()}33`

afterAll(async () => {
  await supabaseAdmin().from('conversaciones').delete().eq('telefono', TELEFONO)
})

describe('«no me escriban más»', () => {
  it('marca la conversación para que el seguimiento no vuelva a contactar al cliente', async () => {
    const resultado = await noSeguir({ telefono: TELEFONO })
    expect(resultado.ok).toBe(true)
    const { data } = await supabaseAdmin()
      .from('conversaciones')
      .select('no_seguir')
      .eq('telefono', TELEFONO)
      .single()
    expect(data?.no_seguir).toBe(true)
  })

  it('es idempotente', async () => {
    expect((await noSeguir({ telefono: TELEFONO })).ok).toBe(true)
  })
})
