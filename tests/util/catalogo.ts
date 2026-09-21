import { supabaseAdmin } from '@/lib/supabase/admin'
import type { MetodoServicio, Servicio } from '@/types/database'

/**
 * Los precios los edita el dueño en el CRM: ninguna prueba puede llevarlos
 * escritos. Se leen de la base y se calcula contra ellos lo que debería cobrar
 * el motor. Así, si mañana la camiseta sube a 2,50, la suite sigue en verde y
 * sigue verificando la regla, que es lo que de verdad importa.
 */
export async function servicioDe(
  nombre_item: string,
  metodo: MetodoServicio = 'unico',
): Promise<Servicio> {
  const { data, error } = await supabaseAdmin()
    .from('servicios')
    .select('*')
    .eq('nombre_item', nombre_item)
    .eq('metodo', metodo)
    .maybeSingle()

  if (error) throw new Error(`No se pudo leer "${nombre_item}": ${error.message}`)
  if (!data) throw new Error(`El catálogo no tiene "${nombre_item}" (${metodo}).`)
  return data as Servicio
}

/** El precio de una unidad, ya en número. */
export async function precioDe(
  nombre_item: string,
  metodo: MetodoServicio = 'unico',
): Promise<number> {
  return Number((await servicioDe(nombre_item, metodo)).precio_min)
}

/** Redondeo a centavos, el mismo que aplica el motor de precios. */
export function centavos(valor: number): number {
  return Math.round(valor * 100) / 100
}
