import type { Sql } from 'postgres'
import { conectar } from './db-conexion.ts'

/**
 * Deja la base como de fábrica para entregarla: sin clientes, sin pedidos y
 * sin rastro de conversaciones. Es para el traspaso a VIP, no para el día a día.
 *
 * NO TOCA lo que es configuración del negocio: el catálogo de servicios, la
 * fila de Configuración, las cuentas del CRM ni la lista blanca de operadores.
 *
 * Por defecto solo SIMULA. Borra de verdad únicamente con `--confirmar`, y lo
 * que borra no se recupera: no hay respaldo automático de esta base.
 */

/** Se vacían en este orden: `pedidos.cliente_id` es `on delete restrict`. */
export const TABLAS_A_VACIAR = [
  'correcciones_cotizacion',
  'pedido_eventos',
  'pedido_items',
  'pedidos',
  'clientes',
  'conversaciones',
  'eventos_procesados',
  'mensajes_diarios',
  'uso_openai_diario',
  'errores_agente',
  // La memoria del agente en n8n: sin esto seguiría recordando charlas viejas.
  'n8n_laundry_chat_histories',
] as const

/** Lo que jamás se toca aquí: es la configuración del negocio, no sus datos. */
export const TABLAS_INTOCABLES = [
  'servicios',
  'configuracion',
  'staff',
  'operador_whitelist',
] as const

export type Conteo = { tabla: string; filas: number }

async function existe(sql: Sql, tabla: string): Promise<boolean> {
  const [fila] = await sql<{ n: number }[]>`
    select count(*)::int as n from information_schema.tables
    where table_schema = 'public' and table_name = ${tabla}
  `
  return (fila?.n ?? 0) > 0
}

export async function contar(sql: Sql): Promise<Conteo[]> {
  const conteos: Conteo[] = []
  for (const tabla of TABLAS_A_VACIAR) {
    if (!(await existe(sql, tabla))) continue
    const [fila] = await sql.unsafe<{ n: number }[]>(`select count(*)::int as n from "${tabla}"`)
    conteos.push({ tabla, filas: fila?.n ?? 0 })
  }
  return conteos
}

export async function vaciar(sql: Sql): Promise<Conteo[]> {
  const borradas: Conteo[] = []
  // Una sola transacción: o queda todo limpio, o no se borra nada.
  await sql.begin(async (tx) => {
    for (const tabla of TABLAS_A_VACIAR) {
      if (!(await existe(tx as unknown as Sql, tabla))) continue
      const filas = await tx.unsafe(`delete from "${tabla}"`)
      borradas.push({ tabla, filas: filas.count ?? 0 })
    }
  })
  return borradas
}

function imprimir(titulo: string, conteos: Conteo[]): void {
  console.log(titulo)
  for (const { tabla, filas } of conteos) {
    console.log(`  ${String(filas).padStart(5)}  ${tabla}`)
  }
  console.log(`  ${String(conteos.reduce((s, c) => s + c.filas, 0)).padStart(5)}  TOTAL`)
}

async function main(): Promise<void> {
  const confirmado = process.argv.includes('--confirmar')
  const sql = conectar()
  try {
    const antes = await contar(sql)

    if (!confirmado) {
      imprimir('Se borraría (simulación, no se tocó nada):', antes)
      console.log(`\nNo se toca: ${TABLAS_INTOCABLES.join(', ')}.`)
      console.log('Para borrar de verdad: pnpm db:reset-clientes --confirmar')
      return
    }

    imprimir('Borrando:', antes)
    await vaciar(sql)
    const despues = await contar(sql)
    const restantes = despues.reduce((suma, c) => suma + c.filas, 0)

    if (restantes > 0) {
      imprimir('Quedaron filas sin borrar:', despues)
      throw new Error('La base no quedó vacía.')
    }
    console.log('\nBase de clientes en cero. El catálogo, la configuración, las')
    console.log('cuentas del CRM y la lista blanca siguen intactos.')
  } finally {
    await sql.end()
  }
}

if (import.meta.filename === process.argv[1]) {
  await main()
}
