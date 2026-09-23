'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { actualizarPrecio, alternarActivo, crear } from '@/server/servicios/repo'

export type EstadoServicio = { error?: string; aviso?: string; ok?: boolean }

const precio = z.coerce.number().min(0, 'El precio no puede ser negativo.')

/** Vacío o ausente = el ítem no tiene promoción por cantidad. */
const precioOpcional = z.union([z.literal(''), precio]).optional()

/** `undefined` = no vino el campo (no se toca); `''` = se quita la promoción. */
function promocion(valor: number | '' | undefined): number | null | undefined {
  if (valor === undefined) return undefined
  return valor === '' ? null : valor
}

const esquemaPrecio = z.object({
  id: z.uuid(),
  precio_min: precio,
  precio_max: precio,
  precio_paquete: precioOpcional,
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
    // Sin el campo en el formulario queda `undefined` y la promoción no se toca.
    precio_paquete: datos.get('precio_paquete') ?? undefined,
  })
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const resultado = await actualizarPrecio(
    analisis.data.id,
    analisis.data.precio_min,
    analisis.data.precio_max,
    promocion(analisis.data.precio_paquete),
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
    precio_paquete: precioOpcional,
  })
  .transform((v) => {
    const porPaquete =
      v.cantidad_por_paquete === '' || v.cantidad_por_paquete === undefined
        ? null
        : v.cantidad_por_paquete
    const paquete = promocion(v.precio_paquete) ?? null
    return {
      ...v,
      // Sin máximo es precio fijo: mínimo y máximo iguales.
      precio_max: v.precio_max === '' || v.precio_max === undefined ? v.precio_min : v.precio_max,
      cantidad_por_paquete: porPaquete,
      // Una promoción sin cuántas prendas la arman no significa nada.
      precio_paquete: porPaquete === null ? null : paquete,
    }
  })
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

  // El alta no decide si hay que preguntar el método: lo decide si la prenda
  // ya existe con otro método. `crear` lo recalcula para todas sus filas.
  const resultado = await crear({ ...analisis.data, requiere_seleccion_metodo: false })
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
