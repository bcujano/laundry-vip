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
  precioPaquete?: number | null,
): Promise<ResultadoEscritura> {
  if (precioMin < 0 || precioMax < 0) {
    return { ok: false, error: 'Un precio no puede ser negativo.' }
  }
  if (precioMax < precioMin) {
    return { ok: false, error: 'El precio máximo no puede ser menor que el mínimo.' }
  }
  if (typeof precioPaquete === 'number' && precioPaquete < 0) {
    return { ok: false, error: 'El precio del paquete no puede ser negativo.' }
  }

  // `undefined` significa «no vino en el formulario»: la promoción no se toca.
  const cambios =
    precioPaquete === undefined
      ? { precio_min: precioMin, precio_max: precioMax }
      : { precio_min: precioMin, precio_max: precioMax, precio_paquete: precioPaquete }

  const { error } = await supabaseAdmin().from('servicios').update(cambios).eq('id', id)

  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Con qué palabras lo pide el cliente. Lo edita el dueño en el CRM. */
export async function actualizarSinonimos(
  id: string,
  sinonimos: string[],
): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin().from('servicios').update({ sinonimos }).eq('id', id)
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
  precio_paquete: number | null
  requiere_seleccion_metodo: boolean
  sinonimos: string[]
}

/**
 * Preguntar el método solo tiene sentido si la prenda existe con varios. Un
 * terno es 'seco' y punto: el agente no debe preguntar nada.
 */
async function sincronizarSeleccionMetodo(nombre_item: string): Promise<void> {
  const cliente = supabaseAdmin()
  const { data } = await cliente.from('servicios').select('id').eq('nombre_item', nombre_item)
  const varios = (data ?? []).length > 1
  await cliente
    .from('servicios')
    .update({ requiere_seleccion_metodo: varios })
    .eq('nombre_item', nombre_item)
}

/** Crea un ítem. El índice único (nombre_item, metodo) impide el duplicado. */
export async function crear(nuevo: NuevoServicio): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin()
    .from('servicios')
    .insert({ ...nuevo, activo: true })

  if (!error) {
    await sincronizarSeleccionMetodo(nuevo.nombre_item)
    return { ok: true }
  }

  // 23505 = unique_violation. Se traduce porque el mensaje de Postgres no le
  // dice nada a quien está mirando la pantalla.
  if (error.code === '23505') {
    return { ok: false, error: `Ya existe "${nuevo.nombre_item}" con ese método.` }
  }
  return { ok: false, error: error.message }
}
