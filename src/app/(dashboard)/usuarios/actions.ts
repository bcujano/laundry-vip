'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirPermiso, verifyAuth } from '@/lib/auth'
import {
  borrar,
  cambiarEstado,
  cambiarPassword,
  cambiarRol,
  contarSuperadmins,
  crear,
} from '@/server/staff/repo'

export type EstadoUsuarios = { error?: string; aviso?: string }

const ROLES = ['superadmin', 'admin', 'operador'] as const

const esquemaNuevo = z.object({
  email: z.email('Escribe un correo válido.'),
  nombre_completo: z.string().trim().min(1, 'El nombre es obligatorio.'),
  rol: z.enum(ROLES),
  password: z.string().min(8, 'La contraseña necesita al menos 8 caracteres.'),
})

export async function crearUsuario(
  _previo: EstadoUsuarios,
  datos: FormData,
): Promise<EstadoUsuarios> {
  if (!(await exigirPermiso('staff'))) {
    return { error: 'Solo el superadmin puede crear cuentas.' }
  }

  const analisis = esquemaNuevo.safeParse(Object.fromEntries(datos))
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const resultado = await crear({
    email: analisis.data.email,
    password: analisis.data.password,
    nombreCompleto: analisis.data.nombre_completo,
    rol: analisis.data.rol,
  })
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/usuarios')
  return { aviso: `Cuenta creada para ${analisis.data.email}.` }
}

export async function cambiarRolUsuario(staffId: string, rol: string): Promise<EstadoUsuarios> {
  const sesion = await exigirPermiso('staff')
  if (!sesion) return { error: 'Solo el superadmin puede cambiar roles.' }

  const analisis = z.enum(ROLES).safeParse(rol)
  if (!analisis.success) return { error: 'Ese rol no existe.' }

  // Nadie se quita a sí mismo el superadmin: sería quedarse fuera solo.
  if (sesion.staff.id === staffId && analisis.data !== 'superadmin') {
    return { error: 'No puedes quitarte a ti mismo el rol de superadmin.' }
  }

  const resultado = await cambiarRol(staffId, analisis.data)
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/usuarios')
  return { aviso: 'Rol actualizado.' }
}

export async function cambiarEstadoUsuario(
  staffId: string,
  activo: boolean,
): Promise<EstadoUsuarios> {
  const sesion = await exigirPermiso('staff')
  if (!sesion) return { error: 'Solo el superadmin puede desactivar cuentas.' }

  if (sesion.staff.id === staffId && !activo) {
    return { error: 'No puedes desactivarte a ti mismo.' }
  }
  if (!activo && (await contarSuperadmins()) <= 1) {
    const esElUltimo = sesion.staff.id === staffId
    if (esElUltimo) return { error: 'Tiene que quedar al menos un superadmin activo.' }
  }

  const resultado = await cambiarEstado(staffId, activo ? 'activo' : 'inactivo')
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/usuarios')
  return { aviso: activo ? 'Cuenta reactivada.' : 'Cuenta desactivada.' }
}

export async function borrarUsuario(staffId: string): Promise<EstadoUsuarios> {
  const sesion = await exigirPermiso('staff')
  if (!sesion) return { error: 'Solo el superadmin puede borrar cuentas.' }

  if (sesion.staff.id === staffId) {
    return { error: 'No puedes borrar tu propia cuenta.' }
  }

  const resultado = await borrar(staffId)
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/usuarios')
  return { aviso: 'Cuenta eliminada.' }
}

const esquemaPassword = z
  .object({
    password: z.string().min(8, 'La contraseña necesita al menos 8 caracteres.'),
    repetir: z.string(),
  })
  .refine((datos) => datos.password === datos.repetir, {
    message: 'Las dos contraseñas no coinciden.',
    path: ['repetir'],
  })

/** Cualquiera puede cambiar SU propia contraseña. */
export async function cambiarMiPassword(
  _previo: EstadoUsuarios,
  datos: FormData,
): Promise<EstadoUsuarios> {
  const sesion = await verifyAuth()
  if (!sesion) return { error: 'Tu sesión expiró. Vuelve a entrar.' }

  const analisis = esquemaPassword.safeParse(Object.fromEntries(datos))
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const resultado = await cambiarPassword(sesion.userId, analisis.data.password)
  if (!resultado.ok) return { error: resultado.error }

  return { aviso: 'Contraseña actualizada.' }
}

/** El superadmin puede reiniciar la contraseña de otro. */
export async function reiniciarPassword(
  authUserId: string,
  password: string,
): Promise<EstadoUsuarios> {
  if (!(await exigirPermiso('staff'))) {
    return { error: 'Solo el superadmin puede reiniciar contraseñas.' }
  }
  if (password.length < 8) {
    return { error: 'La contraseña necesita al menos 8 caracteres.' }
  }

  const resultado = await cambiarPassword(authUserId, password)
  return resultado.ok ? { aviso: 'Contraseña reiniciada.' } : { error: resultado.error }
}
