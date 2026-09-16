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
  it('queda en 54 filas exactas y es idempotente', async () => {
    const primera = await sembrar(sql)
    expect(primera.filasCatalogo).toBe(54)
    const segunda = await sembrar(sql)
    expect(segunda.filasCatalogo).toBe(54)
  })

  it('marca requiere_seleccion_metodo solo en camisa/blusa y camiseta', async () => {
    const filas = await sql<{ nombre_item: string }[]>`
      select distinct nombre_item from servicios where requiere_seleccion_metodo = true
    `
    expect(filas.map((f) => f.nombre_item).sort()).toEqual(['Camisa o blusa', 'Camiseta'])
  })

  it('guarda los dos peluches como rango y el resto con precio único', async () => {
    const rangos = await sql<{ nombre_item: string }[]>`
      select nombre_item from servicios where precio_min <> precio_max order by nombre_item
    `
    expect(rangos.map((f) => f.nombre_item)).toEqual(['Peluche grande', 'Peluche pequeño'])
  })

  it('el índice único rechaza un (nombre_item, metodo) duplicado', async () => {
    await expect(
      sql`
        insert into servicios (categoria, nombre_item, metodo, unidad, precio_min, precio_max)
        values ('Alfombras', 'Alfombra de pelo corto', 'unico', 'm2', 7.00, 7.00)
      `,
    ).rejects.toThrow(/duplicate key|servicios_item_metodo_idx/i)
  })
})
