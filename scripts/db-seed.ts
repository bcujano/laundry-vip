import type { Sql } from 'postgres'
import { CATALOGO } from './catalogo-datos.ts'
import { conectar } from './db-conexion.ts'

export type ResultadoSiembra = {
  filasCatalogo: number
  /** Cuántas filas escribió esta corrida. Con el catálogo ya cargado: 0. */
  cargadas: number
  /** Filas de la lista inicial que hoy no están en la base (el dueño las borró). */
  faltantes: string[]
  /** Filas que el dueño cambió en el CRM respecto de la lista inicial. */
  distintas: string[]
  /** Ítems que el dueño creó desde el CRM y no vienen de la lista inicial. */
  propias: string[]
}

type FilaBase = {
  nombre_item: string
  metodo: string
  categoria: string
  unidad: string
  precio_min: string
  precio_max: string
  cantidad_por_paquete: number | null
  precio_paquete: string | null
  activo: boolean
}

const clave = (fila: { nombre_item: string; metodo: string }) =>
  `${fila.nombre_item} (${fila.metodo})`

function comparar(enBase: FilaBase[]): Omit<ResultadoSiembra, 'filasCatalogo' | 'cargadas'> {
  const porClave = new Map(enBase.map((fila) => [clave(fila), fila]))
  const deLaLista = new Set(CATALOGO.map(clave))

  const faltantes: string[] = []
  const distintas: string[] = []

  for (const item of CATALOGO) {
    const fila = porClave.get(clave(item))
    if (!fila) {
      faltantes.push(clave(item))
      continue
    }
    const cambio =
      Number(fila.precio_min) !== item.precio_min ||
      Number(fila.precio_max) !== item.precio_max ||
      Number(fila.precio_paquete ?? 0) !== (item.precio_paquete ?? 0) ||
      fila.categoria !== item.categoria ||
      fila.unidad !== item.unidad ||
      !fila.activo
    if (cambio) distintas.push(clave(item))
  }

  return {
    faltantes,
    distintas,
    propias: enBase.filter((fila) => !deLaLista.has(clave(fila))).map(clave),
  }
}

/**
 * Carga inicial del catálogo. **El CRM es la fuente de verdad**: si la tabla ya
 * tiene ítems, esta función no escribe nada y solo reporta en qué se diferencia
 * de la lista del archivo del dueño. Así una siembra de rutina nunca revierte
 * un precio que él acaba de cambiar en pantalla.
 *
 * Con `forzar` sí reimpone la lista del repo, ítem por ítem. Es para cuando el
 * dueño pide expresamente «volvé a dejarlo como el archivo».
 */
export async function sembrar(sql: Sql, { forzar = false } = {}): Promise<ResultadoSiembra> {
  const enBase = await sql<FilaBase[]>`
    select nombre_item, metodo, categoria, unidad, precio_min, precio_max,
           cantidad_por_paquete, precio_paquete, activo
    from servicios
  `

  // Un solo viaje a la base: 54 inserciones sueltas contra un pooler remoto
  // tardaban más de 30 segundos.
  const filas = CATALOGO.map((item) => ({ ...item, activo: true }))
  const columnas = [
    'categoria',
    'nombre_item',
    'metodo',
    'unidad',
    'precio_min',
    'precio_max',
    'cantidad_por_paquete',
    'precio_paquete',
    'sinonimos',
    'requiere_seleccion_metodo',
    'activo',
  ] as const

  let cargadas = 0
  if (enBase.length === 0 || forzar) {
    const escritas = forzar
      ? await sql`
          insert into servicios ${sql(filas, ...columnas)}
          on conflict (nombre_item, metodo) do update set
            categoria = excluded.categoria,
            unidad = excluded.unidad,
            precio_min = excluded.precio_min,
            precio_max = excluded.precio_max,
            cantidad_por_paquete = excluded.cantidad_por_paquete,
            precio_paquete = excluded.precio_paquete,
            sinonimos = excluded.sinonimos,
            requiere_seleccion_metodo = excluded.requiere_seleccion_metodo,
            activo = true
        `
      : await sql`
          insert into servicios ${sql(filas, ...columnas)}
          on conflict (nombre_item, metodo) do nothing
        `
    cargadas = escritas.count ?? 0
  }

  // La configuración es una fila única; si ya existe no se toca, porque el
  // dueño pudo haberla ajustado desde el CRM.
  await sql`
    insert into configuracion (
      id, nombre_negocio, dias_operacion,
      hora_recoleccion_inicio, hora_recoleccion_fin,
      hora_apertura, hora_cierre, margen_minimo_minutos
    ) values (
      1, 'Lavandería VIP', '{1,2,3,4,5,6}',
      '08:00', '12:00', '08:00', '17:00', 30
    )
    on conflict (id) do nothing
  `

  const despues = await sql<FilaBase[]>`
    select nombre_item, metodo, categoria, unidad, precio_min, precio_max,
           cantidad_por_paquete, precio_paquete, activo
    from servicios
  `

  return { filasCatalogo: despues.length, cargadas, ...comparar(despues) }
}

function listar(titulo: string, items: string[]): void {
  if (items.length === 0) return
  console.log(`${titulo} (${items.length}): ${items.join(' · ')}`)
}

async function main(): Promise<void> {
  const forzar = process.argv.includes('--forzar')
  const sql = conectar()
  try {
    const resultado = await sembrar(sql, { forzar })
    console.log(`Catálogo: ${resultado.filasCatalogo} filas · ${resultado.cargadas} escritas.`)

    if (resultado.cargadas === 0 && !forzar) {
      console.log('El catálogo ya estaba cargado y manda el CRM: no se tocó nada.')
    }
    listar('Cambiadas por el dueño en el CRM', resultado.distintas)
    listar('Creadas por el dueño en el CRM', resultado.propias)
    listar('De la lista inicial que ya no están', resultado.faltantes)

    if (!forzar && resultado.distintas.length + resultado.faltantes.length > 0) {
      console.log('Para reimponer la lista del archivo: pnpm db:seed --forzar')
    }
  } finally {
    await sql.end()
  }
}

if (import.meta.filename === process.argv[1]) {
  await main()
}
