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

/**
 * Grupos que el dashboard enlaza: cada cifra del tablero abre la lista exacta
 * de pedidos que la compone.
 */
export const GRUPOS_PEDIDOS = {
  discrepancia: 'Congelados por discrepancia',
  esperando_pago: 'Esperando pago para despachar',
  sin_verificar: 'Recolectados sin contar en planta',
  por_verificar: 'Monto estimado, pendiente de conteo',
  verificados: 'Lavado ya verificado',
} as const

export type GrupoPedidos = keyof typeof GRUPOS_PEDIDOS

export function esGrupoPedidos(valor: string): valor is GrupoPedidos {
  return Object.hasOwn(GRUPOS_PEDIDOS, valor)
}

export type FiltroPedidos = {
  pagina?: number
  estado?: EstadoPedido | 'todos'
  canal?: CanalPedido | 'todos'
  grupo?: GrupoPedidos
  /** Solo pedidos creados en los últimos N días. */
  dias?: number
}

const SIN_FACTURAR = '("cancelado","recoleccion_fallida")'
const CERRADOS = '("entregado","cancelado","recoleccion_fallida")'

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

  if (filtro.dias && filtro.dias > 0) {
    const desdeFecha = new Date(Date.now() - filtro.dias * 24 * 60 * 60 * 1000)
    consulta = consulta.gte('created_at', desdeFecha.toISOString())
  }

  switch (filtro.grupo) {
    case 'discrepancia':
      consulta = consulta.eq('discrepancia_detectada', true).not('estado', 'in', CERRADOS)
      break
    case 'esperando_pago':
      consulta = consulta.in('estado', [
        'esperando_pago_para_recoleccion',
        'esperando_pago_para_entrega',
      ])
      break
    case 'sin_verificar':
      consulta = consulta.eq('estado', 'recolectado').eq('discrepancia_detectada', false)
      break
    case 'por_verificar':
      consulta = consulta.is('monto_confirmado_lavado', null).not('estado', 'in', SIN_FACTURAR)
      break
    case 'verificados':
      consulta = consulta
        .not('monto_confirmado_lavado', 'is', null)
        .not('estado', 'in', SIN_FACTURAR)
      break
  }

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
