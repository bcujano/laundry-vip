import { metodoLegible, unidadLegible } from '@/lib/format'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Servicio } from '@/types/database'
import { aCsv } from './csv'

/**
 * La lista de precios tal como está AHORA en el CRM. Es lo que hay que
 * imprimir o mandar: el archivo con el que nació el catálogo envejece en
 * cuanto el dueño cambia un precio en pantalla, y esta descarga no.
 */
export async function csvCatalogo(): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .from('servicios')
    .select('*')
    .order('categoria', { ascending: true })
    .order('nombre_item', { ascending: true })
    .order('metodo', { ascending: true })

  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`)

  return aCsv((data ?? []) as Servicio[], [
    { titulo: 'Categoría', valor: (s) => s.categoria },
    { titulo: 'Prenda o artículo', valor: (s) => s.nombre_item },
    { titulo: 'Método', valor: (s) => metodoLegible(s.metodo) },
    { titulo: 'Se cobra por', valor: (s) => unidadLegible(s.unidad) },
    { titulo: 'Precio USD', valor: (s) => Number(s.precio_min) },
    {
      titulo: 'Precio máximo USD',
      valor: (s) => (Number(s.precio_max) === Number(s.precio_min) ? '' : Number(s.precio_max)),
    },
    {
      titulo: 'Promoción',
      valor: (s) =>
        s.precio_paquete === null
          ? ''
          : `${s.cantidad_por_paquete} por ${Number(s.precio_paquete).toFixed(2)}`,
    },
    { titulo: 'Activo', valor: (s) => s.activo },
  ])
}
