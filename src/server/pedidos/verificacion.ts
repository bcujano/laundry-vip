import { supabaseAdmin } from '@/lib/supabase/admin'
import { crearAvisoDiscrepancia } from '@/server/avisos/repo'
import type { EstadoPedido, PedidoItem } from '@/types/database'
import { type Contexto, leerPedido, type Resultado, registrarEvento } from './comun'

export type ConteoVerificado = { itemDeclaradoId: string; cantidadReal: number }

export type ResultadoConteo = {
  estado: EstadoPedido
  hayDiscrepancia: boolean
  montoConfirmado: number
  montoEstimado: number
  diferencias: { descripcion: string; declarada: number; real: number }[]
}

/**
 * El operador cuenta las prendas en planta contra la lista declarada, ANTES de
 * lavar. Si el conteo cuadra, el pedido avanza solo. Si no cuadra, se marca
 * discrepancia, el pedido se congela y hay que avisar al cliente: nunca se
 * cobra en silencio un monto distinto al que se le dijo.
 */
export async function verificarConteo(
  pedidoId: string,
  conteos: ConteoVerificado[],
  contexto: Contexto,
): Promise<Resultado<ResultadoConteo>> {
  const cliente = supabaseAdmin()
  const pedido = await leerPedido(pedidoId)
  if (!pedido) return { ok: false, error: 'El pedido no existe.' }

  const { data: declaradosCrudos } = await cliente
    .from('pedido_items')
    .select('*')
    .eq('pedido_id', pedidoId)
    .eq('origen', 'declarado')

  const declarados = (declaradosCrudos ?? []) as PedidoItem[]
  if (declarados.length === 0) {
    return { ok: false, error: 'El pedido no tiene prendas declaradas que verificar.' }
  }

  const porId = new Map(declarados.map((item) => [item.id, item]))
  const diferencias: ResultadoConteo['diferencias'] = []
  const verificados: Record<string, unknown>[] = []
  let montoConfirmado = 0

  for (const conteo of conteos) {
    const declarado = porId.get(conteo.itemDeclaradoId)
    if (!declarado) {
      return { ok: false, error: 'Se contó una prenda que no estaba declarada en el pedido.' }
    }
    if (conteo.cantidadReal < 0) {
      return { ok: false, error: 'Una cantidad contada no puede ser negativa.' }
    }

    const precio = Number(declarado.precio_unitario ?? 0)
    const subtotal = precio * conteo.cantidadReal
    montoConfirmado += subtotal

    if (Number(declarado.cantidad) !== conteo.cantidadReal) {
      diferencias.push({
        descripcion: declarado.descripcion,
        declarada: Number(declarado.cantidad),
        real: conteo.cantidadReal,
      })
    }

    verificados.push({
      pedido_id: pedidoId,
      origen: 'verificado',
      item_declarado_id: declarado.id,
      servicio_id: declarado.servicio_id,
      descripcion: declarado.descripcion,
      cantidad: conteo.cantidadReal,
      metodo_elegido: declarado.metodo_elegido,
      precio_unitario: declarado.precio_unitario,
      subtotal,
      no_reconocido: declarado.no_reconocido,
    })
  }

  // Contar de menos una prenda declarada también es una discrepancia.
  if (conteos.length !== declarados.length) {
    return { ok: false, error: 'Faltan prendas por contar: la verificación debe cubrirlas todas.' }
  }

  // Se reemplaza la verificación anterior para que recontar no acumule filas.
  await cliente.from('pedido_items').delete().eq('pedido_id', pedidoId).eq('origen', 'verificado')
  const { error: errorItems } = await cliente.from('pedido_items').insert(verificados)
  if (errorItems) return { ok: false, error: errorItems.message }

  const hayDiscrepancia = diferencias.length > 0
  const nuevoEstado: EstadoPedido = hayDiscrepancia ? 'discrepancia_detectada' : 'en_proceso'
  const motivo = hayDiscrepancia
    ? diferencias
        .map((d) => `${d.descripcion}: declaradas ${d.declarada}, contadas ${d.real}`)
        .join('; ')
    : null

  const { error } = await cliente
    .from('pedidos')
    .update({
      estado: nuevoEstado,
      monto_confirmado_lavado: montoConfirmado,
      // Solo se da por confirmado el cobro si el conteo cuadró.
      pago_lavado: hayDiscrepancia ? pedido.pago_lavado : 'confirmado',
      discrepancia_detectada: hayDiscrepancia,
      discrepancia_motivo: motivo,
    })
    .eq('id', pedidoId)

  if (error) return { ok: false, error: error.message }

  await registrarEvento(pedidoId, pedido.estado, nuevoEstado, {
    ...contexto,
    motivo: motivo ?? 'Conteo verificado sin diferencias',
  })

  if (hayDiscrepancia) {
    await crearAvisoDiscrepancia(pedidoId, {
      tipo: 'discrepancia_conteo',
      montoAnterior: Number(pedido.monto_estimado_lavado ?? 0),
      montoNuevo: montoConfirmado,
      diferencias,
    })
  }

  return {
    ok: true,
    datos: {
      estado: nuevoEstado,
      hayDiscrepancia,
      montoConfirmado,
      montoEstimado: Number(pedido.monto_estimado_lavado ?? 0),
      diferencias,
    },
  }
}
