'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crearPedido } from '@/server/pedidos/crear'
import { avanzarEstado } from '@/server/pedidos/estado'
import { ESTADOS_PEDIDO } from '@/types/database'

export type EstadoPedidos = { error?: string; aviso?: string }

const esquemaNuevo = z.object({
  cliente_id: z.uuid('Elige un cliente.'),
  canal: z.enum(['whatsapp_agente', 'presencial']),
  tipo_entrega: z.enum(['combo', 'a_la_carta', '']).optional(),
  prendas: z.string().trim().min(1, 'Escribe al menos una prenda.'),
  numero_fundas: z.coerce.number().int().min(0).optional(),
  direccion_recoleccion: z.string().trim().optional(),
})

/**
 * Convierte "5 camisetas, 2 pantalones" en la lista que entiende el motor.
 * Cada línea o coma es una prenda; el número inicial es la cantidad.
 */
function interpretarPrendas(texto: string): { descripcion: string; cantidad: number }[] {
  return texto
    .split(/[\n,;]+/)
    .map((trozo) => trozo.trim())
    .filter(Boolean)
    .map((trozo) => {
      const conCantidad = /^(\d+(?:[.,]\d+)?)\s+(.*)$/.exec(trozo)
      return conCantidad
        ? {
            cantidad: Number(conCantidad[1]?.replace(',', '.')),
            descripcion: conCantidad[2] as string,
          }
        : { cantidad: 1, descripcion: trozo }
    })
}

export async function crearPedidoManual(
  _previo: EstadoPedidos,
  datos: FormData,
): Promise<EstadoPedidos> {
  if (!(await exigirPermiso('pedidos'))) {
    return { error: 'No tienes permiso para crear pedidos.' }
  }

  const analisis = esquemaNuevo.safeParse(Object.fromEntries(datos))
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const prendas = interpretarPrendas(analisis.data.prendas)
  if (prendas.some((prenda) => !Number.isFinite(prenda.cantidad) || prenda.cantidad <= 0)) {
    return { error: 'Alguna cantidad no es un número válido.' }
  }

  const esPresencial = analisis.data.canal === 'presencial'
  const resultado = await crearPedido({
    clienteId: analisis.data.cliente_id,
    canal: analisis.data.canal,
    tipoEntrega: esPresencial ? undefined : analisis.data.tipo_entrega || 'combo',
    items: prendas,
    numeroFundas: esPresencial ? undefined : analisis.data.numero_fundas || undefined,
    direccionRecoleccion: esPresencial ? undefined : analisis.data.direccion_recoleccion,
  })

  if (!resultado.ok) return { error: resultado.mensaje }

  revalidatePath('/pedidos')
  revalidatePath('/cola')
  redirect(`/pedidos/${resultado.pedido.id}`)
}

export async function borrarPedido(pedidoId: string): Promise<EstadoPedidos> {
  if (!(await exigirPermiso('borrar'))) {
    return { error: 'Tu rol no puede borrar pedidos.' }
  }

  // Las prendas, los eventos y las correcciones se van con él (cascade).
  const { error } = await supabaseAdmin().from('pedidos').delete().eq('id', pedidoId)
  if (error) return { error: error.message }

  revalidatePath('/pedidos')
  revalidatePath('/cola')
  return { aviso: 'Pedido eliminado.' }
}

export async function moverEstado(pedidoId: string, destino: string): Promise<EstadoPedidos> {
  const sesion = await exigirPermiso('pedidos')
  if (!sesion) return { error: 'No tienes permiso para mover pedidos.' }

  const analisis = z.enum(ESTADOS_PEDIDO).safeParse(destino)
  if (!analisis.success) return { error: 'Ese estado no existe.' }

  const resultado = await avanzarEstado(pedidoId, analisis.data, {
    actor: 'operador',
    staffId: sesion.staff.id,
  })
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/pipeline')
  revalidatePath('/pedidos')
  revalidatePath(`/pedidos/${pedidoId}`)
  return { aviso: `Movido a "${analisis.data.replaceAll('_', ' ')}".` }
}
