'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { actualizarPrecio, alternarActivo, crear } from '@/server/servicios/repo'

export type EstadoServicio = { error?: string; aviso?: string; ok?: boolean }

const precio = z.coerce.number().min(0, 'El precio no puede ser negativo.')

const esquemaPrecio = z.object({
  id: z.uuid(),
  precio_min: precio,
  precio_max: precio,
})

/** Editar precios es solo del superadmin: se rechaza en el servidor. */
export async function guardarPrecio(
  _previo: EstadoServicio,
  datos: FormData,
): Promise<EstadoServicio> {
  if (!(await exigirPermiso('servicios'))) {
    return { error: 'No tienes permiso para editar precios.' }
  }

  const analisis = esquemaPrecio.safeParse({
    id: datos.get('id'),
    precio_min: datos.get('precio_min'),
    precio_max: datos.get('precio_max'),
  })
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const resultado = await actualizarPrecio(
    analisis.data.id,
    analisis.data.precio_min,
    analisis.data.precio_max,
  )
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/servicios')
  return { ok: true }
}

const esquemaNuevo = z
  .object({
    categoria: z.string().trim().min(1, 'La categoría es obligatoria.'),
    nombre_item: z.string().trim().min(1, 'El nombre es obligatorio.'),
    metodo: z.enum(['unico', 'agua', 'seco', 'planchado']),
    unidad: z.enum(['pieza', 'm2', 'kilo', 'libra', 'paquete', 'par']),
    precio_min: precio,
    precio_max: z.union([z.literal(''), precio]).optional(),
    cantidad_por_paquete: z.union([z.literal(''), z.coerce.number().int().positive()]).optional(),
  })
  .transform((v) => ({
    ...v,
    // Sin máximo es precio fijo: mínimo y máximo iguales.
    precio_max: v.precio_max === '' || v.precio_max === undefined ? v.precio_min : v.precio_max,
    cantidad_por_paquete:
      v.unidad === 'paquete' &&
      v.cantidad_por_paquete !== '' &&
      v.cantidad_por_paquete !== undefined
        ? v.cantidad_por_paquete
        : null,
  }))
  .refine((v) => v.precio_max >= v.precio_min, {
    message: 'El precio máximo no puede ser menor que el mínimo.',
  })
  .refine((v) => v.unidad !== 'paquete' || v.cantidad_por_paquete !== null, {
    message: 'Un servicio por paquete necesita cuántas prendas trae el paquete.',
  })

export async function crearServicio(
  _previo: EstadoServicio,
  datos: FormData,
): Promise<EstadoServicio> {
  if (!(await exigirPermiso('servicios'))) {
    return { error: 'No tienes permiso para editar el catálogo.' }
  }

  const analisis = esquemaNuevo.safeParse(Object.fromEntries(datos))
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const resultado = await crear({
    ...analisis.data,
    // Un método distinto de «único» significa que la prenda se lava de varias
    // formas: el agente tiene que preguntar cuál antes de dar precio.
    requiere_seleccion_metodo: analisis.data.metodo !== 'unico',
  })
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/servicios')
  return { ok: true }
}

export async function cambiarActivo(id: string, activo: boolean): Promise<EstadoServicio> {
  if (!(await exigirPermiso('servicios'))) {
    return { error: 'No tienes permiso para editar el catálogo.' }
  }
  const resultado = await alternarActivo(id, activo)
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/servicios')
  return { ok: true }
}

/** Borra un ítem del catálogo. Los pedidos viejos conservan su descripción. */
export async function borrarServicio(id: string): Promise<EstadoServicio> {
  if (!(await exigirPermiso('borrar'))) {
    return { error: 'Tu rol no puede borrar ítems del catálogo.' }
  }

  const { error } = await supabaseAdmin().from('servicios').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/servicios')
  return { ok: true }
}
