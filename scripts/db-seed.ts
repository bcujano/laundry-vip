import type { Sql } from 'postgres'
import { CATALOGO, TOTAL_ESPERADO } from './catalogo-datos.ts'
import { conectar } from './db-conexion.ts'

export type ResultadoSiembra = { filasCatalogo: number }

/**
 * Siembra idempotente: el upsert va contra (nombre_item, metodo), así que
 * correrla dos veces actualiza precios en vez de duplicar filas.
 */
export async function sembrar(sql: Sql): Promise<ResultadoSiembra> {
  // Un solo viaje a la base: 54 inserciones sueltas contra un pooler remoto
  // tardaban más de 30 segundos.
  const filas = CATALOGO.map((item) => ({ ...item, activo: true }))

  await sql`
    insert into servicios ${sql(
      filas,
      'categoria',
      'nombre_item',
      'metodo',
      'unidad',
      'precio_min',
      'precio_max',
      'cantidad_por_paquete',
      'requiere_seleccion_metodo',
      'activo',
    )}
    on conflict (nombre_item, metodo) do update set
      categoria = excluded.categoria,
      unidad = excluded.unidad,
      precio_min = excluded.precio_min,
      precio_max = excluded.precio_max,
      cantidad_por_paquete = excluded.cantidad_por_paquete,
      requiere_seleccion_metodo = excluded.requiere_seleccion_metodo,
      activo = true
  `

  // La configuración es una fila única; si ya existe no se toca, porque el
  // dueño pudo haberla ajustado desde el CRM.
  await sql`insert into configuracion (id) values (1) on conflict (id) do nothing`

  const [conteo] = await sql<{ total: number }[]>`
    select count(*)::int as total from servicios
  `
  const filasCatalogo = conteo?.total ?? 0

  if (filasCatalogo !== TOTAL_ESPERADO) {
    throw new Error(
      `El catálogo debe tener ${TOTAL_ESPERADO} filas y tiene ${filasCatalogo}. ` +
        'La lista física de la planta no cuadra con lo sembrado.',
    )
  }

  return { filasCatalogo }
}

async function main(): Promise<void> {
  const sql = conectar()
  try {
    const { filasCatalogo } = await sembrar(sql)
    console.log(`Catálogo sembrado: ${filasCatalogo} filas.`)
  } finally {
    await sql.end()
  }
}

if (import.meta.filename === process.argv[1]) {
  await main()
}
