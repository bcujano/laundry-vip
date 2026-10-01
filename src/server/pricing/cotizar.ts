import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Servicio } from '@/types/database'
import {
  agrupar,
  cotizarGrupo,
  emparejar,
  type ItemPedido,
  type LineaCotizada,
  NOTA_SIN_PRECIO,
  parecidos,
  redondear,
} from './linea'

/**
 * Motor de precios: fuente única de verdad. El webhook del agente nunca
 * calcula un precio por su cuenta, siempre llama aquí.
 *
 * Reglas que no se negocian:
 *   - Nunca se asume un método cuando el ítem admite varios.
 *   - Nunca se inventa un precio para algo que no está en el catálogo.
 *   - Nunca se elige un extremo de un rango.
 *   - Todo lo que sale de aquí es un ESTIMADO, pendiente de verificación en planta.
 */

export type { ItemPedido, LineaCotizada } from './linea'

export type Cotizacion = {
  lineas: LineaCotizada[]
  resumen: {
    /** Siempre. Un estimado no es un cobro. */
    estado: 'estimado_pendiente_verificacion'
    subtotal: number
    lineas_con_precio: number
    lineas_sin_precio: number
    requiere_respuesta_del_cliente: boolean
  }
}

export class ErrorCotizacion extends Error {
  constructor(
    readonly codigo: 'ITEMS_VACIOS' | 'CANTIDAD_INVALIDA',
    mensaje: string,
  ) {
    super(mensaje)
  }
}

async function catalogoActivo(): Promise<Servicio[]> {
  const { data, error } = await supabaseAdmin().from('servicios').select('*').eq('activo', true)
  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`)
  return (data ?? []) as Servicio[]
}

/**
 * Cotiza una lista de prendas contra el catálogo real. Es lectura pura: no
 * escribe absolutamente nada.
 */
export async function cotizarPrendas(items: ItemPedido[]): Promise<Cotizacion> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ErrorCotizacion('ITEMS_VACIOS', 'No se recibió ninguna prenda para cotizar.')
  }
  for (const item of items) {
    if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      throw new ErrorCotizacion(
        'CANTIDAD_INVALIDA',
        `La cantidad de "${item.descripcion}" debe ser mayor que cero.`,
      )
    }
  }

  const grupos = agrupar(await catalogoActivo())

  const lineas = items.map((item): LineaCotizada => {
    const { ganador, finalistas } = emparejar(item.descripcion, grupos)

    // Nada se parece: nunca se inventa un precio, pero TAMPOCO se niega el
    // servicio. Se devuelven los parecidos para que el agente pregunte.
    if (finalistas.length === 0) {
      const sugerencias = parecidos(item.descripcion, grupos)
      return {
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        encontrado: false,
        ...(sugerencias.length > 0 ? { sugerencias } : {}),
        nota:
          sugerencias.length > 0
            ? 'No es exacto. Pregúntale si se refiere a alguna de las sugerencias; nunca digas que no se ofrece.'
            : `${NOTA_SIN_PRECIO}. NO digas que no se ofrece: el operador confirma en planta.`,
      }
    }

    // Varias prendas distintas encajan: se pregunta, no se adivina.
    if (!ganador) {
      return {
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        encontrado: false,
        requiere_desambiguacion: true,
        opciones: finalistas.map((grupo) => {
          const fila = grupo.filas[0] as Servicio
          return {
            nombre_item: grupo.nombre_item,
            precio_min: Number(fila.precio_min),
            precio_max: Number(fila.precio_max),
            unidad: fila.unidad,
          }
        }),
        nota: 'Hay varias opciones con ese nombre. Hay que preguntar cuál es.',
      }
    }

    return cotizarGrupo(item, ganador)
  })

  const conPrecio = lineas.filter((linea) => linea.subtotal !== undefined)

  return {
    lineas,
    resumen: {
      estado: 'estimado_pendiente_verificacion',
      subtotal: redondear(conPrecio.reduce((suma, linea) => suma + (linea.subtotal ?? 0), 0)),
      lineas_con_precio: conPrecio.length,
      lineas_sin_precio: lineas.length - conPrecio.length,
      requiere_respuesta_del_cliente: lineas.some(
        (linea) => linea.requiere_metodo || linea.requiere_desambiguacion,
      ),
    },
  }
}

/**
 * Decisión del dueño (2026-10-01): la recolección y la entrega SIEMPRE van en auto,
 * sin importar cuántas fundas sean. El número de fundas ya no decide nada ni se le
 * pregunta al cliente; el parámetro se acepta solo para no romper llamadas viejas.
 */
export function calcularVehiculo(_numeroFundas?: number): 'auto' {
  return 'auto'
}
