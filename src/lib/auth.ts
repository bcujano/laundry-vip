import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'
import type { Staff } from '@/types/database'

export type Sesion = { userId: string; email: string; staff: Staff }

/**
 * Devuelve la sesión solo si hay un usuario válido CON ficha de staff activa.
 * Devuelve null —nunca lanza— si el token es inválido, si no existe la fila en
 * staff o si el staff está inactivo. Un empleado dado de baja es, a todos los
 * efectos, un anónimo.
 */
export async function verifyAuth(): Promise<Sesion | null> {
  try {
    const supabase = await supabaseServer()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null

    // La consulta va con service_role: RLS niega todo por defecto y la
    // autorización real la decide este archivo, no la base.
    const { data: staff, error: errorStaff } = await supabaseAdmin()
      .from('staff')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .maybeSingle()

    if (errorStaff || !staff) return null
    const ficha = staff as Staff
    if (ficha.estado !== 'activo') return null

    return { userId: data.user.id, email: data.user.email ?? '', staff: ficha }
  } catch {
    return null
  }
}

import { type Area as AreaPermiso, puede } from './permisos'

export { type Area, puede } from './permisos'

/** Igual que verifyAuth, pero además exige permiso sobre un área. */
export async function exigirPermiso(area: AreaPermiso): Promise<Sesion | null> {
  const sesion = await verifyAuth()
  if (!sesion) return null
  return puede(sesion.staff.rol, area) ? sesion : null
}
