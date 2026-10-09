/**
 * Respaldo lógico de la base: cada tabla de `public` a un JSON dentro de
 * `respaldos/<fecha>-<etiqueta>/` (carpeta fuera de git: trae datos de clientes).
 *
 *   pnpm db:respaldo [etiqueta]        → crea el respaldo
 *   pnpm db:respaldo --listar          → muestra los respaldos que hay
 *
 * Es solo lectura. Restaurar una tabla es decisión humana y se hace con cuidado:
 * cada archivo trae las filas tal cual (`restaurar` NO existe a propósito).
 * scripts/ no usa el alias @/.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { conectar, RAIZ_PROYECTO } from './db-conexion.ts'

const CARPETA = resolve(RAIZ_PROYECTO, 'respaldos')

function listar() {
  try {
    for (const nombre of readdirSync(CARPETA).sort()) {
      const archivos = readdirSync(resolve(CARPETA, nombre))
      const bytes = archivos.reduce((s, a) => s + statSync(resolve(CARPETA, nombre, a)).size, 0)
      console.log(`${nombre}  ${archivos.length} tablas  ${(bytes / 1024).toFixed(0)} KB`)
    }
  } catch {
    console.log('No hay respaldos todavía.')
  }
}

async function respaldar(etiqueta: string) {
  const sql = conectar()
  try {
    const fecha = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    const destino = resolve(CARPETA, `${fecha}-${etiqueta}`)
    mkdirSync(destino, { recursive: true })
    const tablas = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`
    let filas = 0
    for (const { table_name } of tablas) {
      const datos = await sql.unsafe(`select * from public."${table_name}"`)
      writeFileSync(resolve(destino, `${table_name}.json`), JSON.stringify(datos, null, 1))
      filas += datos.length
    }
    console.log(`Respaldo en ${destino}: ${tablas.length} tablas, ${filas} filas.`)
  } finally {
    await sql.end()
  }
}

const arg = process.argv[2]
if (arg === '--listar') listar()
else await respaldar((arg ?? 'manual').replace(/[^a-z0-9-]/gi, '-'))
