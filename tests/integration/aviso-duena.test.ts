import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { adminsParaAviso } from '@/server/avisos/duenas'
import { corrida, prefijoTelefono } from '../util/corrida.ts'

const PREFIJO = prefijoTelefono(corrida())
const ADMIN_RECIENTE = `${PREFIJO}01`
const ADMIN_VIEJA = `${PREFIJO}02`
const OPERADOR = `${PREFIJO}03`

afterAll(async () => {
  await supabaseAdmin().from('operador_whitelist').delete().like('telefono', `${PREFIJO}%`)
})

describe('a quién se le avisa de un lead sin respuesta', () => {
  it('solo las administradoras activas, y texto libre solo si escribieron en las últimas 24 h', async () => {
    const ahora = new Date()
    const hace = (horas: number) => new Date(ahora.getTime() - horas * 3_600_000).toISOString()
    await supabaseAdmin()
      .from('operador_whitelist')
      .insert([
        {
          telefono: ADMIN_RECIENTE,
          nombre: 'Admin reciente',
          nivel: 'admin',
          ultimo_mensaje_en: hace(2),
        },
        {
          telefono: ADMIN_VIEJA,
          nombre: 'Admin vieja',
          nivel: 'admin',
          ultimo_mensaje_en: hace(30),
        },
        { telefono: OPERADOR, nombre: 'Operador', nivel: 'operador', ultimo_mensaje_en: hace(1) },
      ])

    const admins = await adminsParaAviso(ahora)
    const mios = admins.filter((a) => a.telefono.startsWith(PREFIJO.replace('+', '')))
    expect(mios.map((a) => a.nombre).sort()).toEqual(['Admin reciente', 'Admin vieja'])
    expect(mios.find((a) => a.nombre === 'Admin reciente')?.dentro_de_ventana).toBe(true)
    expect(mios.find((a) => a.nombre === 'Admin vieja')?.dentro_de_ventana).toBe(false)
    // el teléfono sale solo con dígitos, como lo pide la API de WhatsApp
    expect(mios[0]?.telefono).toMatch(/^\d+$/)
  })
})
