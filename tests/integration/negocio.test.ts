import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { comoVamos } from '@/server/reportes/negocio'
import { corrida } from '../util/corrida.ts'

/**
 * La radiografía contra la base real. La aritmética se prueba aparte y sin
 * base (`tests/unit/negocio.test.ts`): aquí solo se verifica que lo que se
 * crea SÍ entra en el mes en curso.
 *
 * Las comparaciones son «al menos»: otras pruebas crean y borran pedidos en
 * paralelo sobre esta misma base, así que un total exacto sería una carrera
 * perdida de antemano.
 */
const CORRIDA = corrida()
const TELEFONO = `+5939${CORRIDA}88`
const MONTO = 37.77
let clienteId = ''

afterAll(async () => {
  const cliente = supabaseAdmin()
  if (clienteId) {
    await cliente.from('pedidos').delete().eq('cliente_id', clienteId)
    await cliente.from('clientes').delete().eq('id', clienteId)
  }
})

describe('«¿cómo vamos?» contra la base real', () => {
  it('un pedido de hoy entra en el mes en curso y su cliente cuenta como nuevo', async () => {
    const { data: cliente, error } = await supabaseAdmin()
      .from('clientes')
      .insert({
        telefono: TELEFONO,
        nombre_negocio: `Hotel Radiografía ${CORRIDA}`,
        tipo_negocio: 'hotel',
        canal_origen: 'whatsapp_agente',
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    clienteId = cliente.id

    const { error: errorPedido } = await supabaseAdmin().from('pedidos').insert({
      cliente_id: clienteId,
      canal: 'whatsapp_agente',
      estado: 'entregado',
      monto_confirmado_lavado: MONTO,
    })
    if (errorPedido) throw new Error(errorPedido.message)

    const datos = await comoVamos()

    expect(datos.mes_en_curso.pedidos).toBeGreaterThanOrEqual(1)
    expect(datos.mes_en_curso.facturado_usd).toBeGreaterThanOrEqual(MONTO)
    expect(datos.clientes.nuevos_este_mes).toBeGreaterThanOrEqual(1)
    // El mes anterior está cerrado: un pedido de hoy no puede tocarlo.
    expect(datos.mes_anterior.desde < datos.mes_en_curso.desde).toBe(true)
    expect(datos.nota).toContain('estimados')
  })

  it('un pedido cancelado no suma a lo facturado', async () => {
    const antes = await comoVamos()
    const exagerado = 999_999

    const { data: pedido } = await supabaseAdmin()
      .from('pedidos')
      .insert({
        cliente_id: clienteId,
        canal: 'whatsapp_agente',
        estado: 'cancelado',
        monto_confirmado_lavado: exagerado,
      })
      .select('id')
      .single()

    const despues = await comoVamos()
    // El monto es absurdo a propósito: si se colara, ninguna otra prueba
    // corriendo en paralelo podría explicar la diferencia.
    expect(despues.mes_en_curso.facturado_usd).toBeLessThan(antes.mes_en_curso.facturado_usd + 1000)

    if (pedido) await supabaseAdmin().from('pedidos').delete().eq('id', pedido.id)
  })
})
