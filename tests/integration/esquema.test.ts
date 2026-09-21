import type { Sql } from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TABLAS } from '@/types/database'
import { conectar } from '../../scripts/db-conexion.ts'
import { aplicarMigraciones, leerMigraciones } from '../../scripts/db-migrate.ts'
import { sembrar } from '../../scripts/db-seed.ts'

let sql: Sql

beforeAll(() => {
  sql = conectar(process.env.TEST_DATABASE_URL)
})

afterAll(async () => {
  await sql.end()
})

describe('migraciones', () => {
  it('aplica todas en una base limpia y luego ninguna', async () => {
    // Se prueba contra un esquema aparte para no tocar los datos reales.
    const esquema = `prueba_migraciones_${Date.now()}`
    const aislada = conectar(process.env.TEST_DATABASE_URL)
    try {
      await aislada`create schema ${aislada(esquema)}`
      await aislada.unsafe(`set search_path to ${esquema}, public`)

      const primera = await aplicarMigraciones(aislada)
      expect(primera).toHaveLength(leerMigraciones().length)

      const segunda = await aplicarMigraciones(aislada)
      expect(segunda).toHaveLength(0)
    } finally {
      await aislada.unsafe(`drop schema if exists ${esquema} cascade`)
      await aislada.end()
    }
  })

  it('dejó registro de cada archivo aplicado', async () => {
    const filas = await sql<{ nombre: string }[]>`select nombre from schema_migrations`
    const enDisco = leerMigraciones().map((m) => m.nombre)
    expect(filas.map((f) => f.nombre).sort()).toEqual(enDisco.sort())
  })
})

describe('las 14 tablas', () => {
  it('existen y responden a una consulta', async () => {
    for (const tabla of TABLAS) {
      const filas = await sql.unsafe(`select 1 from ${tabla} limit 1`)
      expect(Array.isArray(filas)).toBe(true)
    }
    expect(TABLAS).toHaveLength(14)
  })

  it('tiene RLS habilitado en las 14', async () => {
    const filas = await sql<{ relname: string }[]>`
      select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relrowsecurity = true
        and c.relname = any(${sql.array([...TABLAS])})
    `
    expect(filas).toHaveLength(14)
  })
})

describe('catálogo', () => {
  it('con el catálogo ya cargado, sembrar no escribe nada', async () => {
    // El CRM es la fuente de verdad: una siembra de rutina no puede revertir
    // un precio que el dueño acaba de cambiar en pantalla.
    const antes = await sql<{ total: number }[]>`select count(*)::int as total from servicios`

    const primera = await sembrar(sql)
    expect(primera.cargadas).toBe(0)
    expect(primera.filasCatalogo).toBe(antes[0]?.total)

    const segunda = await sembrar(sql)
    expect(segunda.cargadas).toBe(0)
    expect(segunda.filasCatalogo).toBe(primera.filasCatalogo)
  })

  it('un ítem que se lava de varias formas exige elegir el método', async () => {
    const incoherentes = await sql<{ nombre_item: string }[]>`
      select nombre_item from servicios
      group by nombre_item
      having count(*) > 1 and bool_and(requiere_seleccion_metodo) = false
    `
    expect(incoherentes).toEqual([])
  })

  it('el índice único rechaza un (nombre_item, metodo) duplicado', async () => {
    const [existente] = await sql<{ nombre_item: string; metodo: string }[]>`
      select nombre_item, metodo from servicios limit 1
    `
    if (!existente) throw new Error('catálogo vacío')

    await expect(
      sql`
        insert into servicios (categoria, nombre_item, metodo, unidad, precio_min, precio_max)
        values ('Prueba', ${existente.nombre_item}, ${existente.metodo}, 'pieza', 1.00, 1.00)
      `,
    ).rejects.toThrow(/duplicate key|servicios_item_metodo_idx/i)
  })

  it('el check rechaza un rango con máximo menor que el mínimo', async () => {
    await expect(
      sql`
        insert into servicios (categoria, nombre_item, metodo, unidad, precio_min, precio_max)
        values ('Prueba', ${`Rango imposible ${Date.now()}`}, 'unico', 'pieza', 9.00, 1.00)
      `,
    ).rejects.toThrow(/servicios_rango_coherente/i)
  })
})
