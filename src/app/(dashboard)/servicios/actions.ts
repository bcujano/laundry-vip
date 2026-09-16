'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/auth'
import { actualizarPrecio, alternarActivo, crear } from '@/server/servicios/repo'

export type EstadoServicio = { error?: string; ok?: boolean }

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

const esquemaNuevo = z.object({
  categoria: z.string().min(1, 'La categoría es obligatoria.'),
  nombre_item: z.string().min(1, 'El nombre es obligatorio.'),
  metodo: z.enum(['unico', 'agua', 'seco', 'planchado']),
  unidad: z.enum(['pieza', 'm2', 'kilo', 'libra', 'paquete', 'par']),
  precio_min: precio,
  precio_max: precio,
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
    cantidad_por_paquete: null,
    requiere_seleccion_metodo: false,
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
