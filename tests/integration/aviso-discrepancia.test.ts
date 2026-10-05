import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { marcarAviso, ventanaAbierta } from '@/server/avisos/repo'
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
    expect(['pendiente', 'requiere_persona']).toContain(avisos?.[0]?.estado)

    // Recontar con el mismo resultado no duplica el aviso.
    await verificarConteo(pedidoId, [{ itemDeclaradoId: itemId, cantidadReal: 7 }], ctx)
    const { data: sinDuplicar } = await db
      .from('avisos_cliente')
      .select('id')
      .eq('pedido_id', pedidoId)
    expect(sinDuplicar).toHaveLength(1)

    // El flujo real de avisos (n8n, cada 5 min) también lee esta tabla y puede pasar el aviso a
    // «requiere_persona» o «enviado» mientras corre la prueba: se prueba la lógica sin esa carrera.
    const ahora = new Date()
    const hace = (h: number) => new Date(ahora.getTime() - h * 3_600_000).toISOString()
    expect(ventanaAbierta(null, ahora)).toBe(false)
    expect(ventanaAbierta(hace(2), ahora)).toBe(true)
    expect(ventanaAbierta(hace(23.9), ahora)).toBe(false)
    expect(ventanaAbierta(hace(30), ahora)).toBe(false)

    // Marcarlo deja huella y no se deshace sola.
    await marcarAviso(avisos?.[0]?.id as string, 'enviado')
    const { data: marcado } = await db
      .from('avisos_cliente')
      .select('estado')
      .eq('pedido_id', pedidoId)
    expect(marcado?.[0]?.estado).toBe('enviado')
  })
})
