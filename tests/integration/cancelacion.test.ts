import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener } from '@/server/configuracion/repo'
import { calcularCancelacion, pedirDevolucionTrasCancelar } from '@/server/pedidos/cancelacion'
import { avanzarEstado } from '@/server/pedidos/estado'
import { corrida } from '../util/corrida.ts'

const CORRIDA = corrida()
const TELEFONO = `+5939${CORRIDA}22`
const CONTEXTO = { actor: 'operador' as const, staffId: null }

let clienteId = ''

async function pedido(estado: string, transporte: 'app' | 'propio_cliente') {
  const cliente = supabaseAdmin()
  if (!clienteId) {
    const { data, error } = await cliente
      .from('clientes')
      .insert({
        telefono: TELEFONO,
        nombre_negocio: `Cancelación ${CORRIDA}`,
        canal_origen: 'whatsapp_agente',
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    clienteId = data.id
  }
  const { data, error } = await cliente
    .from('pedidos')
    .insert({
      cliente_id: clienteId,
      canal: 'whatsapp_agente',
      estado,
      tipo_entrega: transporte === 'app' ? 'combo' : 'a_la_carta',
      metodo_transporte_recoleccion: transporte,
      monto_estimado_lavado: 10,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

async function leer(id: string) {
  const { data } = await supabaseAdmin().from('pedidos').select('*').eq('id', id).single()
  return data as {
    estado: string
    monto_cancelacion: number | null
    cancelacion_con_devolucion: boolean
  }
}

afterAll(async () => {
  const cliente = supabaseAdmin()
  await cliente.from('pedidos').delete().eq('cliente_id', clienteId)
  await cliente.from('clientes').delete().eq('id', clienteId)
})

describe('cargo por cancelar con la ropa ya recogida (2026-10-09)', () => {
  it('la regla: un tramo si retira en planta, dos si pide devolución, nada si no se recogió', () => {
    const recogido = {
      estado: 'en_proceso',
      tipo_entrega: 'combo',
      metodo_transporte_recoleccion: 'n_a',
    } as const
    expect(calcularCancelacion(recogido, false, 2.5)).toBe(2.5)
    expect(calcularCancelacion(recogido, true, 2.5)).toBe(5)
    expect(
      calcularCancelacion(
        { estado: 'nuevo', tipo_entrega: 'combo', metodo_transporte_recoleccion: 'n_a' },
        false,
        2.5,
      ),
    ).toBeNull()
    expect(
      calcularCancelacion(
        {
          estado: 'en_proceso',
          tipo_entrega: 'a_la_carta',
          metodo_transporte_recoleccion: 'propio_cliente',
        },
        false,
        2.5,
      ),
    ).toBeNull()
  })

  it('cancelar con la ropa recogida cobra un tramo y después suma el de devolución', async () => {
    const tarifa = Number((await obtener()).tarifa_recoleccion_entrega)
    const id = await pedido('en_proceso', 'app')

    const resultado = await avanzarEstado(id, 'cancelado', CONTEXTO)
    expect(resultado.ok).toBe(true)
    const cancelado = await leer(id)
    expect(cancelado.estado).toBe('cancelado')
    expect(Number(cancelado.monto_cancelacion)).toBe(tarifa)
    expect(cancelado.cancelacion_con_devolucion).toBe(false)

    const devolucion = await pedirDevolucionTrasCancelar(id)
    expect(devolucion.ok).toBe(true)
    const conDevolucion = await leer(id)
    expect(Number(conDevolucion.monto_cancelacion)).toBe(tarifa * 2)
    expect(conDevolucion.cancelacion_con_devolucion).toBe(true)
  })

  it('cancelar un pedido que aún no se recogió no cobra nada', async () => {
    const id = await pedido('nuevo', 'app')
    const resultado = await avanzarEstado(id, 'cancelado', CONTEXTO)
    expect(resultado.ok).toBe(true)
    expect((await leer(id)).monto_cancelacion).toBeNull()
    const devolucion = await pedirDevolucionTrasCancelar(id)
    expect(devolucion.ok).toBe(false)
  })
})
