import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres, { type Sql } from 'postgres'

// scripts/ no usa el alias @/: tsx no resuelve los paths de tsconfig.
const RAIZ = resolve(import.meta.dirname, '..')

/** Carga .env.local igual que Next, para no duplicar credenciales. */
export function cargarEntorno(): void {
  const archivo = resolve(RAIZ, '.env.local')
  if (existsSync(archivo)) process.loadEnvFile(archivo)
}

/**
 * Abre una conexión a Postgres. `prepare: false` porque la conexión pasa por
 * el session pooler de Supabase (IPv4); las sentencias preparadas del lado del
 * cliente no sobreviven al pooler.
 */
export function conectar(url?: string): Sql {
  cargarEntorno()
  const cadena = url ?? process.env.SUPABASE_DB_URL
  if (!cadena) {
    throw new Error('Falta SUPABASE_DB_URL: no hay a dónde conectarse.')
  }
  return postgres(cadena, { max: 1, prepare: false, onnotice: () => {} })
}

export const RAIZ_PROYECTO = RAIZ
