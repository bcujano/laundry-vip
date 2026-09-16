import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Cliente, TipoNegocio } from '@/types/database'

/** Toda lista del CRM pagina de a 50: es un panel de trabajo, no un catálogo. */
export const POR_PAGINA = 50

export type FiltroClientes = {
  pagina?: number
  tipoNegocio?: TipoNegocio | 'todos'
  busqueda?: string
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

  let consulta = supabaseAdmin()
    .from('clientes')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(desde, desde + POR_PAGINA - 1)

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
    clientes: (data ?? []) as Cliente[],
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
