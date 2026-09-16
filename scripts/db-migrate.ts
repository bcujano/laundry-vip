import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Sql } from 'postgres'
import { conectar, RAIZ_PROYECTO } from './db-conexion.ts'

const DIRECTORIO = resolve(RAIZ_PROYECTO, 'supabase/migrations')

export type Migracion = { nombre: string; sql: string }

/** Lee las migraciones del disco en orden numérico. */
export function leerMigraciones(): Migracion[] {
  return readdirSync(DIRECTORIO)
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort()
    .map((nombre) => ({ nombre, sql: readFileSync(resolve(DIRECTORIO, nombre), 'utf8') }))
}

async function asegurarRegistro(sql: Sql): Promise<void> {
  await sql`
    create table if not exists schema_migrations (
      nombre text primary key,
      aplicada_en timestamptz not null default now()
    )
  `
}

/**
 * Aplica las migraciones que falten y devuelve sus nombres.
 * Una migración ya aplicada nunca se vuelve a ejecutar ni se edita: todo
 * cambio posterior es un archivo nuevo.
 */
export async function aplicarMigraciones(sql: Sql): Promise<string[]> {
  await asegurarRegistro(sql)

  const filas = await sql<{ nombre: string }[]>`select nombre from schema_migrations`
  const yaAplicadas = new Set(filas.map((fila) => fila.nombre))
  const aplicadas: string[] = []

  for (const migracion of leerMigraciones()) {
    if (yaAplicadas.has(migracion.nombre)) continue
    // Cada migración es atómica: o entra entera o no entra.
    await sql.begin(async (tx) => {
      await tx.unsafe(migracion.sql)
      await tx`insert into schema_migrations (nombre) values (${migracion.nombre})`
    })
    aplicadas.push(migracion.nombre)
  }

  return aplicadas
}

async function main(): Promise<void> {
  const sql = conectar()
  try {
    const aplicadas = await aplicarMigraciones(sql)
    if (aplicadas.length === 0) {
      console.log('Sin migraciones pendientes.')
    } else {
      for (const nombre of aplicadas) console.log(`aplicada  ${nombre}`)
      console.log(`${aplicadas.length} migración(es) aplicada(s).`)
    }
  } finally {
    await sql.end()
  }
}

if (import.meta.filename === process.argv[1]) {
  await main()
}
