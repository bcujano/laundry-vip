'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { normalizarTelefono } from '@/lib/telefono'

export type EstadoClientes = { error?: string; aviso?: string }

const esquema = z.object({
  telefono: z.string().min(1, 'El teléfono es obligatorio.'),
  nombre_negocio: z.string().trim().optional(),
  nombre_contacto: z.string().trim().optional(),
  tipo_negocio: z.enum(['clinica', 'restaurante', 'hotel', 'otro', 'particular']),
  modelo_facturacion: z.enum(['por_pedido', 'consolidado_mensual']),
})

export async function crearCliente(
  _previo: EstadoClientes,
  datos: FormData,
): Promise<EstadoClientes> {
  if (!(await exigirPermiso('clientes'))) {
    return { error: 'No tienes permiso para crear clientes.' }
  }

  const analisis = esquema.safeParse(Object.fromEntries(datos))
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  // Lo que se escriba se normaliza; no se le exige formato internacional a nadie.
  const telefono = normalizarTelefono(analisis.data.telefono)
  if (!telefono) return { error: `"${analisis.data.telefono}" no parece un teléfono.` }

  const { error } = await supabaseAdmin()
    .from('clientes')
    .insert({
      telefono,
      nombre_negocio: analisis.data.nombre_negocio || null,
      nombre_contacto: analisis.data.nombre_contacto || null,
      tipo_negocio: analisis.data.tipo_negocio,
      modelo_facturacion: analisis.data.modelo_facturacion,
      canal_origen: 'presencial',
    })

  if (error) {
    return {
      error: error.code === '23505' ? 'Ya hay un cliente con ese teléfono.' : error.message,
    }
  }

  revalidatePath('/clientes')
  return { aviso: 'Cliente creado.' }
}

export async function editarCliente(
  clienteId: string,
  _previo: EstadoClientes,
  datos: FormData,
): Promise<EstadoClientes> {
  if (!(await exigirPermiso('clientes'))) {
    return { error: 'No tienes permiso para editar clientes.' }
  }

  const analisis = esquema.safeParse(Object.fromEntries(datos))
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const telefono = normalizarTelefono(analisis.data.telefono)
  if (!telefono) return { error: `"${analisis.data.telefono}" no parece un teléfono.` }

  const { error } = await supabaseAdmin()
    .from('clientes')
    .update({
      telefono,
      nombre_negocio: analisis.data.nombre_negocio || null,
      nombre_contacto: analisis.data.nombre_contacto || null,
      tipo_negocio: analisis.data.tipo_negocio,
      modelo_facturacion: analisis.data.modelo_facturacion,
    })
    .eq('id', clienteId)

  if (error) return { error: error.message }

  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath('/clientes')
  return { aviso: 'Cambios guardados.' }
}

/**
 * Borrar un cliente. La base lo impide si tiene pedidos (on delete restrict),
 * y aquí se traduce ese rechazo a algo que se entienda en pantalla.
 */
export async function borrarCliente(clienteId: string): Promise<EstadoClientes> {
  if (!(await exigirPermiso('borrar'))) {
    return { error: 'Tu rol no puede borrar clientes.' }
  }

  const { error } = await supabaseAdmin().from('clientes').delete().eq('id', clienteId)

  if (error) {
    return {
      error:
        error.code === '23503'
          ? 'Ese cliente tiene pedidos en el historial, así que no se puede borrar. Su historial es parte de la contabilidad.'
          : error.message,
    }
  }

  revalidatePath('/clientes')
  return { aviso: 'Cliente eliminado.' }
}
