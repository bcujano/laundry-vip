import { createClient } from '@supabase/supabase-js'
import { cargarEntorno, conectar } from './db-conexion.ts'

/**
 * Crea las cuentas del CRM. No hay autoregistro: las cuentas se invitan a mano
 * y esto es esa mano. No envía ningún correo; el acceso se hace después con el
 * enlace mágico desde /login.
 */
const CUENTAS = [
  { email: 'brncjn@gmail.com', nombre: 'Byron David', rol: 'superadmin' },
  { email: 'brncjn+admin@gmail.com', nombre: 'Administración (prueba)', rol: 'admin' },
  { email: 'dcwacks.89@gmail.com', nombre: 'Operador de planta', rol: 'operador' },
] as const

const TELEFONOS_OPERADORES = [{ telefono: '+593963987124', nombre: 'Operador de planta' }]

async function main(): Promise<void> {
  cargarEntorno()
  const url = process.env.SUPABASE_URL
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !llave) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')

  const auth = createClient(url, llave, { auth: { persistSession: false } }).auth.admin
  const sql = conectar()

  try {
    const { data: existentes } = await auth.listUsers({ perPage: 1000 })
    const porCorreo = new Map(existentes.users.map((u) => [u.email ?? '', u.id]))

    for (const cuenta of CUENTAS) {
      let userId = porCorreo.get(cuenta.email)

      if (!userId) {
        const { data, error } = await auth.createUser({
          email: cuenta.email,
          email_confirm: true,
        })
        if (error || !data.user)
          throw new Error(`No se pudo crear ${cuenta.email}: ${error?.message}`)
        userId = data.user.id
      }

      await sql`
        insert into staff (auth_user_id, nombre_completo, rol, estado)
        values (${userId}, ${cuenta.nombre}, ${cuenta.rol}, 'activo')
        on conflict (auth_user_id) do update set
          nombre_completo = excluded.nombre_completo,
          rol = excluded.rol,
          estado = 'activo'
      `
      console.log(`${cuenta.rol.padEnd(10)} ${cuenta.email}`)
    }

    for (const operador of TELEFONOS_OPERADORES) {
      await sql`
        insert into operador_whitelist (telefono, nombre, activo)
        values (${operador.telefono}, ${operador.nombre}, true)
        on conflict (telefono) do update set nombre = excluded.nombre, activo = true
      `
      console.log(`whitelist  ${operador.telefono}`)
    }
  } finally {
    await sql.end()
  }
}

if (import.meta.filename === process.argv[1]) {
  await main()
}
