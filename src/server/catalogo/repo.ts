import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import { agruparCatalogo, type CategoriaCatalogo, dinero } from './agrupar'

export type DatosCatalogo = {
  negocio: string
  categorias: CategoriaCatalogo[]
  pie: string[]
}

/** Lo que lleva la imagen del catálogo: servicios activos y los datos de Configuración. */
export async function datosDelCatalogo(): Promise<DatosCatalogo> {
  const [config, { data, error }] = await Promise.all([
    obtenerConfig(),
    supabaseAdmin()
      .from('servicios')
      .select(
        'categoria, nombre_item, metodo, unidad, precio_min, precio_max, cantidad_por_paquete, precio_paquete',
      )
      .eq('activo', true),
  ])
  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`)

  return {
    negocio: config.nombre_negocio,
    categorias: agruparCatalogo(data ?? []),
    pie: [
      `Recogida y entrega a domicilio: ${dinero(Number(config.tarifa_recoleccion_entrega))}`,
      `Entrega en ${config.horas_entrega_min} a ${config.horas_entrega_max} horas`,
      'Los valores son un estimado: se confirman al recibir la ropa',
    ],
  }
}
