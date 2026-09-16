'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/auth'
import { confirmarPago, corregirCotizacion, resolverDiscrepancia } from '@/server/pedidos/cobros'
import { avanzarEstado } from '@/server/pedidos/estado'
import { verificarConteo } from '@/server/pedidos/verificacion'
import { ESTADOS_PEDIDO } from '@/types/database'

export type EstadoAccion = { error?: string; aviso?: string; ok?: boolean }

/** Todas las acciones del detalle pasan por aquí: sin sesión no se toca nada. */
async function contexto() {
  const sesion = await exigirPermiso('pedidos')
  if (!sesion) return null
  return { actor: 'operador' as const, staffId: sesion.staff.id }
}

export async function verificarConteoAccion(
  pedidoId: string,
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const ctx = await contexto()
  if (!ctx) return { error: 'No tienes permiso para verificar el conteo.' }

  const conteos: { itemDeclaradoId: string; cantidadReal: number }[] = []
  for (const [clave, valor] of datos.entries()) {
    if (!clave.startsWith('conteo:')) continue
    const cantidad = Number(valor)
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      return { error: 'Hay una cantidad contada que no es un número válido.' }
    }
    conteos.push({ itemDeclaradoId: clave.slice('conteo:'.length), cantidadReal: cantidad })
  }

  if (conteos.length === 0) return { error: 'No se contó ninguna prenda.' }

  const resultado = await verificarConteo(pedidoId, conteos, ctx)
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath(`/pedidos/${pedidoId}`)

  return resultado.datos.hayDiscrepancia
    ? {
        ok: true,
        aviso:
          'El conteo no cuadra. El pedido quedó congelado y hay que avisar al cliente antes de cobrarle.',
      }
    : { ok: true, aviso: 'Conteo verificado. El pedido pasó a "en proceso".' }
}

const tramos = z.enum(['recoleccion', 'entrega', 'lavado'])

export async function confirmarPagoAccion(pedidoId: string, tramo: string): Promise<EstadoAccion> {
  const ctx = await contexto()
  if (!ctx) return { error: 'No tienes permiso para confirmar pagos.' }

  const analisis = tramos.safeParse(tramo)
  if (!analisis.success) return { error: 'Tramo desconocido.' }

  const resultado = await confirmarPago(pedidoId, analisis.data, ctx)
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath(`/pedidos/${pedidoId}`)
  return {
    ok: true,
    aviso: resultado.datos.despachoLiberado
      ? 'Pago confirmado. El despacho de ese tramo queda liberado.'
      : 'Pago confirmado.',
  }
}

const esquemaCorreccion = z.object({
  monto: z.coerce.number().min(0, 'El monto no puede ser negativo.'),
  motivo: z.string().trim().min(1, 'Escribe el motivo: hay que explicárselo al cliente.'),
})

export async function corregirCotizacionAccion(
  pedidoId: string,
  _previo: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  const ctx = await contexto()
  if (!ctx) return { error: 'No tienes permiso para corregir cotizaciones.' }

  const analisis = esquemaCorreccion.safeParse({
    monto: datos.get('monto'),
    motivo: datos.get('motivo'),
  })
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const resultado = await corregirCotizacion(
    pedidoId,
    analisis.data.monto,
    analisis.data.motivo,
    ctx,
  )
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath(`/pedidos/${pedidoId}`)
  // La ficha del cliente también muestra el pedido y su botón de discrepancia.
  revalidatePath('/clientes/[id]', 'page')
  return {
    ok: true,
    aviso: `Corregido de ${resultado.datos.montoAnterior.toFixed(2)} a ${resultado.datos.montoCorregido.toFixed(2)}. Hay que avisar al cliente antes de pedirle el pago.`,
  }
}

export async function resolverDiscrepanciaAccion(pedidoId: string): Promise<EstadoAccion> {
  const ctx = await contexto()
  if (!ctx) return { error: 'No tienes permiso para cerrar discrepancias.' }

  const resultado = await resolverDiscrepancia(pedidoId, ctx)
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath(`/pedidos/${pedidoId}`)
  // La ficha del cliente también muestra el pedido y su botón de discrepancia.
  revalidatePath('/clientes/[id]', 'page')
  return { ok: true, aviso: 'Discrepancia cerrada. El pedido sigue su curso.' }
}

export async function avanzarEstadoAccion(
  pedidoId: string,
  destino: string,
): Promise<EstadoAccion> {
  const ctx = await contexto()
  if (!ctx) return { error: 'No tienes permiso para mover el pedido.' }

  const analisis = z.enum(ESTADOS_PEDIDO).safeParse(destino)
  if (!analisis.success) return { error: 'Ese estado no existe.' }

  const resultado = await avanzarEstado(pedidoId, analisis.data, ctx)
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath(`/pedidos/${pedidoId}`)
  return { ok: true, aviso: `El pedido pasó a "${analisis.data}".` }
}
