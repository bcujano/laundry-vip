import { supabaseAdmin } from '@/lib/supabase/admin'
import type { CanalOrigen, Cliente, Conversacion, TipoNegocio } from '@/types/database'

/** Toda lista del CRM pagina de a 50: es un panel de trabajo, no un catálogo. */
export const POR_PAGINA = 50

/** Segmentos que enlaza el dashboard: leads que ya compraron y los que no. */
export const SEGMENTOS_CLIENTES = {
  con_pedidos: 'Con al menos un pedido',
  sin_pedidos: 'Leads sin pedido todavía',
} as const

export type SegmentoClientes = keyof typeof SEGMENTOS_CLIENTES

export function esSegmentoClientes(valor: string): valor is SegmentoClientes {
  return Object.hasOwn(SEGMENTOS_CLIENTES, valor)
}

export type FiltroClientes = {
  pagina?: number
  tipoNegocio?: TipoNegocio | 'todos'
  busqueda?: string
  segmento?: SegmentoClientes
  canal?: CanalOrigen
}

export type PaginaClientes = {
  clientes: Cliente[]
  total: number
  pagina: number
  paginas: number
}

export async function listar(filtro: FiltroClientes = {}): Promise<PaginaClientes> {
  const pagina = Math.max(1, filtro.pagina ?? 1)
  const desde = (pagina - 1) * POR_PAGINA

  // Embeber pedidos(id) permite filtrar por "tiene o no tiene pedidos" en la
  // misma consulta: !inner se queda con los que tienen, left + null con los que no.
  const seleccion =
    filtro.segmento === 'con_pedidos'
      ? '*, pedidos!inner(id)'
      : filtro.segmento === 'sin_pedidos'
        ? '*, pedidos!left(id)'
        : '*'

  let consulta = supabaseAdmin()
    .from('clientes')
    .select(seleccion, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(desde, desde + POR_PAGINA - 1)

  if (filtro.segmento === 'sin_pedidos') consulta = consulta.is('pedidos', null)
  if (filtro.canal) consulta = consulta.eq('canal_origen', filtro.canal)

  if (filtro.tipoNegocio && filtro.tipoNegocio !== 'todos') {
    consulta = consulta.eq('tipo_negocio', filtro.tipoNegocio)
  }

  const busqueda = filtro.busqueda?.trim()
  if (busqueda) {
    // Insensible a mayúsculas y por coincidencia parcial: quien busca en el
    // panel escribe "clinic", no el nombre exacto del negocio.
    const patron = `%${busqueda.replace(/[%_]/g, '')}%`
    consulta = consulta.or(
      `nombre_negocio.ilike.${patron},nombre_contacto.ilike.${patron},telefono.ilike.${patron}`,
    )
  }

  const { data, error, count } = await consulta
  if (error) throw new Error(`No se pudieron leer los clientes: ${error.message}`)

  const total = count ?? 0
  return {
    clientes: ((data ?? []) as unknown as (Cliente & { pedidos?: unknown })[]).map(
      ({ pedidos: _pedidos, ...cliente }) => cliente as Cliente,
    ),
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  }
}

export async function obtener(id: string): Promise<Cliente | null> {
  const { data, error } = await supabaseAdmin()
    .from('clientes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`No se pudo leer el cliente: ${error.message}`)
  return (data as Cliente | null) ?? null
}

export async function obtenerPorTelefono(telefono: string): Promise<Cliente | null> {
  const { data, error } = await supabaseAdmin()
    .from('clientes')
    .select('*')
    .eq('telefono', telefono)
    .maybeSingle()

  if (error) throw new Error(`No se pudo leer el cliente: ${error.message}`)
  return (data as Cliente | null) ?? null
}

/** Lo último que el agente registró de la conversación de WhatsApp con este cliente. */
export async function conversacionDe(telefono: string): Promise<Conversacion | null> {
  const { data, error } = await supabaseAdmin()
    .from('conversaciones')
    .select('*')
    .eq('telefono', telefono)
    .maybeSingle()

  if (error) throw new Error(`No se pudo leer la conversación: ${error.message}`)
  return (data as Conversacion | null) ?? null
}
