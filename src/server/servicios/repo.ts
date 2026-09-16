import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Servicio } from '@/types/database'

export type CategoriaConServicios = { categoria: string; items: Servicio[] }

export type ResultadoEscritura = { ok: true } | { ok: false; error: string }

/** El catálogo completo, agrupado por categoría y en orden de lectura. */
export async function listarPorCategoria(): Promise<CategoriaConServicios[]> {
  const { data, error } = await supabaseAdmin()
    .from('servicios')
    .select('*')
    .order('categoria', { ascending: true })
    .order('nombre_item', { ascending: true })
    .order('metodo', { ascending: true })

  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`)

  const porCategoria = new Map<string, Servicio[]>()
  for (const fila of (data ?? []) as Servicio[]) {
    const items = porCategoria.get(fila.categoria) ?? []
    items.push(fila)
    porCategoria.set(fila.categoria, items)
  }

  return [...porCategoria.entries()].map(([categoria, items]) => ({ categoria, items }))
}

export async function contar(): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from('servicios')
    .select('id', { count: 'exact', head: true })

  if (error) throw new Error(`No se pudo contar el catálogo: ${error.message}`)
  return count ?? 0
}

export async function obtener(id: string): Promise<Servicio | null> {
  const { data, error } = await supabaseAdmin()
    .from('servicios')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`No se pudo leer el servicio: ${error.message}`)
  return (data as Servicio | null) ?? null
}

/**
 * Cambia el precio de un ítem. Un precio único llega con min = max; el rango
 * solo existe donde la lista de la planta lo tiene (los dos peluches).
 */
export async function actualizarPrecio(
  id: string,
  precioMin: number,
  precioMax: number,
): Promise<ResultadoEscritura> {
  if (precioMin < 0 || precioMax < 0) {
    return { ok: false, error: 'Un precio no puede ser negativo.' }
  }
  if (precioMax < precioMin) {
    return { ok: false, error: 'El precio máximo no puede ser menor que el mínimo.' }
  }

  const { error } = await supabaseAdmin()
    .from('servicios')
    .update({ precio_min: precioMin, precio_max: precioMax })
    .eq('id', id)

  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function alternarActivo(id: string, activo: boolean): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin().from('servicios').update({ activo }).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export type NuevoServicio = {
  categoria: string
  nombre_item: string
  metodo: Servicio['metodo']
  unidad: Servicio['unidad']
  precio_min: number
  precio_max: number
  cantidad_por_paquete: number | null
  requiere_seleccion_metodo: boolean
}

/** Crea un ítem. El índice único (nombre_item, metodo) impide el duplicado. */
export async function crear(nuevo: NuevoServicio): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin()
    .from('servicios')
    .insert({ ...nuevo, activo: true })

  if (!error) return { ok: true }

  // 23505 = unique_violation. Se traduce porque el mensaje de Postgres no le
  // dice nada a quien está mirando la pantalla.
  if (error.code === '23505') {
    return { ok: false, error: `Ya existe "${nuevo.nombre_item}" con ese método.` }
  }
  return { ok: false, error: error.message }
}
