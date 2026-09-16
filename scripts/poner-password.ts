import { createClient } from '@supabase/supabase-js'
import { cargarEntorno } from './db-conexion.ts'

/**
 * Pone la contraseña de una cuenta existente.
 * Uso: pnpm db:password correo@ejemplo.com [contraseña]
 * Sin contraseña, genera una fuerte y la imprime una sola vez.
 */
async function main(): Promise<void> {
  cargarEntorno()
  const email = process.argv[2]
  if (!email) throw new Error('Falta el correo: pnpm db:password correo@ejemplo.com')

  const password = process.argv[3] ?? generar()

  const auth = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  ).auth.admin

  const { data } = await auth.listUsers({ perPage: 1000 })
  const usuario = data.users.find((u) => u.email === email)
  if (!usuario) throw new Error(`No existe ninguna cuenta con el correo ${email}.`)

  const { error } = await auth.updateUserById(usuario.id, { password })
  if (error) throw new Error(error.message)

  console.log(`\n  correo:     ${email}`)
  console.log(`  contraseña: ${password}\n`)
  console.log('  Cámbiala al entrar, en Usuarios > Mi contraseña.\n')
}

/** Aleatoria y legible: sin caracteres que se confundan al dictarla. */
function generar(): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
}

if (import.meta.filename === process.argv[1]) {
  await main()
}
