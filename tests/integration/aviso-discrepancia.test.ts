import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { avisosPendientes, marcarAviso } from '@/server/avisos/repo'
import { crearPedido } from '@/server/pedidos/crear'
import { verificarConteo } from '@/server/pedidos/verificacion'
import { corrida, prefijoTelefono } from '../util/corrida.ts'

const PREFIJO = prefijoTelefono(corrida())
const TELEFONO = `${PREFIJO}01`
let clienteId = ''

afterAll(async () => {
  const db = supabaseAdmin()
  if (clienteId) await db.from('pedidos').delete().eq('cliente_id', clienteId)
  await db.from('conversaciones').delete().eq('telefono', TELEFONO)
  await db.from('clientes').delete().like('telefono', `${PREFIJO}%`)
})

describe('aviso automático al cliente por discrepancia de conteo', () => {
  it('si el conteo no cuadra, queda un aviso con cifras de la base; si cuadra, no', async () => {
    const db = supabaseAdmin()
    const { data: cliente } = await db
      .from('clientes')
      .insert({
        telefono: TELEFONO,
        nombre_contacto: 'Cliente Prueba',
        nombre_contacto_origen: 'cliente',
        canal_origen: 'whatsapp_agente',
      })
      .select('id')
      .single()
    clienteId = cliente?.id as string

    const creado = await crearPedido({
      clienteId,
      canal: 'whatsapp_agente',
      tipoEntrega: 'a_la_carta',
      items: [{ descripcion: '3 camisetas', cantidad: 3, metodo: 'agua' }],
      metodoRecoleccion: 'propio_cliente',
      metodoEntrega: 'propio_cliente',
    })
    expect(creado.ok).toBe(true)
    if (!creado.ok) return
    const pedidoId = creado.pedido.id

    const { data: items } = await db
      .from('pedido_items')
      .select('id')
      .eq('pedido_id', pedidoId)
      .eq('origen', 'declarado')
    const itemId = items?.[0]?.id as string
    const ctx = { actor: 'operador' as const }

    // Cuadra: no hay aviso.
    await verificarConteo(pedidoId, [{ itemDeclaradoId: itemId, cantidadReal: 3 }], ctx)
    const { data: ninguno } = await db.from('avisos_cliente').select('id').eq('pedido_id', pedidoId)
    expect(ninguno).toHaveLength(0)

    // No cuadra: un aviso, con el nombre que dijo el cliente y las cifras.
    await verificarConteo(pedidoId, [{ itemDeclaradoId: itemId, cantidadReal: 7 }], ctx)
    const { data: avisos } = await db.from('avisos_cliente').select('*').eq('pedido_id', pedidoId)
    expect(avisos).toHaveLength(1)
    expect(avisos?.[0]?.texto).toContain('Hola, Cliente Prueba.')
    expect(avisos?.[0]?.texto).toContain('usted indicó 3 y contamos 7')
    expect(avisos?.[0]?.estado).toBe('pendiente')

    // Recontar con el mismo resultado no duplica el aviso.
    await verificarConteo(pedidoId, [{ itemDeclaradoId: itemId, cantidadReal: 7 }], ctx)
    const { data: sinDuplicar } = await db
      .from('avisos_cliente')
      .select('id')
      .eq('pedido_id', pedidoId)
    expect(sinDuplicar).toHaveLength(1)

    // Sin conversación reciente la ventana de WhatsApp no está abierta: no se escribe texto libre.
    const pendientes = (await avisosPendientes()).filter((a) => a.telefono === TELEFONO)
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.ventana_abierta).toBe(false)

    // Con el cliente hablando ahora, sí.
    await db
      .from('conversaciones')
      .upsert(
        { telefono: TELEFONO, contexto: {}, chatwoot_conversation_id: 999999 },
        { onConflict: 'telefono' },
      )
    const abiertas = (await avisosPendientes()).filter((a) => a.telefono === TELEFONO)
    expect(abiertas[0]?.ventana_abierta).toBe(true)

    await marcarAviso(abiertas[0]?.id as string, 'enviado')
    expect((await avisosPendientes()).filter((a) => a.telefono === TELEFONO)).toHaveLength(0)
  })
})
