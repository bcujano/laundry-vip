import { supabaseAdmin } from '@/lib/supabase/admin'
import { limitesDelDia } from '@/server/scheduling/ventana'
import type {
  CanalPedido,
  CorreccionCotizacion,
  EstadoPedido,
  Pedido,
  PedidoEvento,
  PedidoItem,
} from '@/types/database'

export const POR_PAGINA = 50

export type PedidoConCliente = Pedido & {
  cliente: {
    id: string
    nombre_negocio: string | null
    nombre_contacto: string | null
    telefono: string
  } | null
}

const SELECCION = '*, cliente:clientes(id, nombre_negocio, nombre_contacto, telefono)'

/**
 * Los pedidos cuya recolección cae hoy, en hora de Quito, ordenados por hora.
 * Es la pantalla de inicio: lo que hay que hacer hoy, en el orden en que toca.
 */
export async function colaDeHoy(ahora = new Date()): Promise<PedidoConCliente[]> {
  const { desde, hasta } = limitesDelDia(ahora)

  const { data, error } = await supabaseAdmin()
    .from('pedidos')
    .select(SELECCION)
    .gte('ventana_recoleccion_inicio', desde.toISOString())
    .lt('ventana_recoleccion_inicio', hasta.toISOString())
    .order('ventana_recoleccion_inicio', { ascending: true })

  if (error) throw new Error(`No se pudo leer la cola de hoy: ${error.message}`)
  return (data ?? []) as PedidoConCliente[]
}

export type FiltroPedidos = {
  pagina?: number
  estado?: EstadoPedido | 'todos'
  canal?: CanalPedido | 'todos'
}

export type PaginaPedidos = {
  pedidos: PedidoConCliente[]
  total: number
  pagina: number
  paginas: number
}

export async function listar(filtro: FiltroPedidos = {}): Promise<PaginaPedidos> {
  const pagina = Math.max(1, filtro.pagina ?? 1)
  const desde = (pagina - 1) * POR_PAGINA

  let consulta = supabaseAdmin()
    .from('pedidos')
    .select(SELECCION, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(desde, desde + POR_PAGINA - 1)

  if (filtro.estado && filtro.estado !== 'todos') consulta = consulta.eq('estado', filtro.estado)
  if (filtro.canal && filtro.canal !== 'todos') consulta = consulta.eq('canal', filtro.canal)

  const { data, error, count } = await consulta
  if (error) throw new Error(`No se pudieron leer los pedidos: ${error.message}`)

  const total = count ?? 0
  return {
    pedidos: (data ?? []) as PedidoConCliente[],
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  }
}

export type PedidoCompleto = {
  pedido: PedidoConCliente
  items: PedidoItem[]
  eventos: PedidoEvento[]
  correcciones: CorreccionCotizacion[]
}

export async function obtener(id: string): Promise<PedidoCompleto | null> {
  const cliente = supabaseAdmin()
  const { data, error } = await cliente.from('pedidos').select(SELECCION).eq('id', id).maybeSingle()
  if (error) throw new Error(`No se pudo leer el pedido: ${error.message}`)
  if (!data) return null

  const [items, eventos, correcciones] = await Promise.all([
    cliente.from('pedido_items').select('*').eq('pedido_id', id).order('created_at'),
    cliente.from('pedido_eventos').select('*').eq('pedido_id', id).order('created_at'),
    cliente.from('correcciones_cotizacion').select('*').eq('pedido_id', id).order('created_at'),
  ])

  return {
    pedido: data as PedidoConCliente,
    items: (items.data ?? []) as PedidoItem[],
    eventos: (eventos.data ?? []) as PedidoEvento[],
    correcciones: (correcciones.data ?? []) as CorreccionCotizacion[],
  }
}

export async function ultimoDelCliente(clienteId: string): Promise<Pedido | null> {
  const { data, error } = await supabaseAdmin()
    .from('pedidos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`No se pudo leer el último pedido: ${error.message}`)
  return (data as Pedido | null) ?? null
}
