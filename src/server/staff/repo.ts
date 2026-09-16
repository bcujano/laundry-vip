import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { RolStaff, Staff } from '@/types/database'

export type ResultadoEscritura = { ok: true } | { ok: false; error: string }

export type StaffConCorreo = Staff & { email: string }

function authAdmin() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  }).auth.admin
}

/** El staff con su correo, que vive en auth.users y no en nuestra tabla. */
export async function listar(): Promise<StaffConCorreo[]> {
  const { data, error } = await supabaseAdmin()
    .from('staff')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`No se pudo leer el personal: ${error.message}`)

  const { data: usuarios } = await authAdmin().listUsers({ perPage: 1000 })
  const correos = new Map(usuarios.users.map((u) => [u.id, u.email ?? '']))

  return (data ?? []).map((fila) => ({
    ...(fila as Staff),
    email: correos.get((fila as Staff).auth_user_id) ?? '(sin correo)',
  }))
}

export type NuevoUsuario = {
  email: string
  password: string
  nombreCompleto: string
  rol: RolStaff
}

/**
 * Crea la cuenta y su ficha de staff. No hay autoregistro: esto es lo único
 * que da de alta a alguien. La contraseña la escribe quien invita y la cambia
 * el usuario después desde su perfil.
 */
export async function crear(nuevo: NuevoUsuario): Promise<ResultadoEscritura> {
  const auth = authAdmin()

  const { data, error } = await auth.createUser({
    email: nuevo.email,
    password: nuevo.password,
    email_confirm: true,
  })

  if (error || !data.user) {
    const mensaje = error?.message ?? 'No se pudo crear el usuario.'
    return {
      ok: false,
      error: /already|registered|exists/i.test(mensaje)
        ? `Ya existe una cuenta con el correo ${nuevo.email}.`
        : mensaje,
    }
  }

  const { error: errorStaff } = await supabaseAdmin().from('staff').insert({
    auth_user_id: data.user.id,
    nombre_completo: nuevo.nombreCompleto,
    rol: nuevo.rol,
    estado: 'activo',
  })

  if (errorStaff) {
    // Si la ficha falla, la cuenta de acceso no puede quedar huérfana.
    await auth.deleteUser(data.user.id)
    return { ok: false, error: errorStaff.message }
  }

  return { ok: true }
}

export async function cambiarRol(staffId: string, rol: RolStaff): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin().from('staff').update({ rol }).eq('id', staffId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function cambiarEstado(
  staffId: string,
  estado: 'activo' | 'inactivo',
): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin().from('staff').update({ estado }).eq('id', staffId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Cambia la contraseña de una cuenta. La usa el superadmin y el propio dueño. */
export async function cambiarPassword(
  authUserId: string,
  password: string,
): Promise<ResultadoEscritura> {
  const { error } = await authAdmin().updateUserById(authUserId, { password })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Borra la ficha y la cuenta de acceso. Irreversible. */
export async function borrar(staffId: string): Promise<ResultadoEscritura> {
  const cliente = supabaseAdmin()

  const { data: ficha } = await cliente
    .from('staff')
    .select('auth_user_id')
    .eq('id', staffId)
    .maybeSingle()

  if (!ficha) return { ok: false, error: 'Ese usuario ya no existe.' }

  const { error } = await cliente.from('staff').delete().eq('id', staffId)
  if (error) return { ok: false, error: error.message }

  await authAdmin().deleteUser(ficha.auth_user_id)
  return { ok: true }
}

/** Cuántos superadmin activos quedan. Nunca puede quedar cero. */
export async function contarSuperadmins(): Promise<number> {
  const { count } = await supabaseAdmin()
    .from('staff')
    .select('id', { count: 'exact', head: true })
    .eq('rol', 'superadmin')
    .eq('estado', 'activo')

  return count ?? 0
}
