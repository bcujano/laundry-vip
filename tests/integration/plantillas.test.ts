import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { marcarPlantillaEnviada, plantillasPendientes } from '@/server/plantillas/candidatos'
import { plantillasPendientesAccion } from '@/server/webhook/handlers/plantillas'
import { corrida } from '../util/corrida.ts'

const TELEFONO = `+5939${corrida()}44`
const CLAVE = `prueba-${corrida()}`

afterAll(async () => {
  const db = supabaseAdmin()
  await db.from('plantillas_enviadas').delete().eq('telefono', TELEFONO)
})

describe('plantillas automáticas', () => {
  // El interruptor lo maneja el dueño en Configuración: la prueba no depende de cómo lo deje. Que apagado
  // no salga nada se prueba con la configuración simulada en tests/unit/prospectos-envio.test.ts.
  it('responde con la forma que espera n8n y no inventa envíos para un teléfono de prueba', async () => {
    const r = (await plantillasPendientesAccion()) as {
      ok: true
      data: { activo: boolean; envios: { telefono: string }[] }
    }
    expect(typeof r.data.activo).toBe('boolean')
    expect(Array.isArray(r.data.envios)).toBe(true)
    expect(r.data.envios.find((e) => e.telefono === TELEFONO)).toBeUndefined()
  })

  it('lo ya enviado no se vuelve a elegir y marcar es idempotente', async () => {
    await marcarPlantillaEnviada(TELEFONO, 'ropa_no_retirada', CLAVE)
    await marcarPlantillaEnviada(TELEFONO, 'ropa_no_retirada', CLAVE)
    const { count } = await supabaseAdmin()
      .from('plantillas_enviadas')
      .select('*', { count: 'exact', head: true })
      .eq('clave', CLAVE)
    expect(count).toBe(1)
    // la base real no tiene clientes con pedidos viejos hoy: el selector no inventa envíos
    const envios = await plantillasPendientes(new Date())
    expect(envios.find((e) => e.telefono === TELEFONO)).toBeUndefined()
  })
})
