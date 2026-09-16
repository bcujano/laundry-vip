import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { conectar } from '../../scripts/db-conexion.ts'

let sql: Sql
const telefonos: string[] = []

/** Teléfono E.164 irrepetible, para no chocar con datos de otra corrida. */
function telefonoDePrueba(): string {
  const unico = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 10))
  const telefono = `+593${unico}`
  telefonos.push(telefono)
  return telefono
}

async function crearCliente(): Promise<string> {
  const [cliente] = await sql<{ id: string }[]>`
    insert into clientes (telefono, nombre_contacto, canal_origen)
    values (${telefonoDePrueba()}, 'Prueba', 'whatsapp_agente')
    returning id
  `
  if (!cliente) throw new Error('no se creó el cliente de prueba')
  return cliente.id
}

async function crearPedido(clienteId: string): Promise<string> {
  const [pedido] = await sql<{ id: string }[]>`
    insert into pedidos (cliente_id, canal, tipo_entrega)
    values (${clienteId}, 'whatsapp_agente', 'combo')
    returning id
  `
  if (!pedido) throw new Error('no se creó el pedido de prueba')
  return pedido.id
}

beforeAll(() => {
  sql = conectar(process.env.TEST_DATABASE_URL)
})

afterEach(async () => {
  if (telefonos.length === 0) return
  const ids = await sql<{ id: string }[]>`
    select id from clientes where telefono = any(${sql.array(telefonos)})
  `
  for (const { id } of ids) {
    await sql`delete from pedidos where cliente_id = ${id}`
  }
  await sql`delete from clientes where telefono = any(${sql.array(telefonos)})`
  telefonos.length = 0
})

afterAll(async () => {
  await sql.end()
})

describe('integridad referencial', () => {
  it('borrar un pedido arrastra ítems, eventos y correcciones', async () => {
    const clienteId = await crearCliente()
    const pedidoId = await crearPedido(clienteId)

    await sql`
      insert into pedido_items (pedido_id, origen, descripcion, cantidad)
      values (${pedidoId}, 'declarado', '3 camisetas', 3)
    `
    await sql`
      insert into pedido_eventos (pedido_id, estado_nuevo, actor)
      values (${pedidoId}, 'nuevo', 'agente')
    `
    await sql`
      insert into correcciones_cotizacion (pedido_id, monto_anterior, monto_corregido, motivo)
      values (${pedidoId}, 10.00, 12.00, 'conteo real')
    `

    await sql`delete from pedidos where id = ${pedidoId}`

    for (const tabla of ['pedido_items', 'pedido_eventos', 'correcciones_cotizacion']) {
      const filas = await sql.unsafe(`select 1 from ${tabla} where pedido_id = $1`, [pedidoId])
      expect(filas).toHaveLength(0)
    }
  })

  it('no deja borrar un cliente que tiene pedidos', async () => {
    const clienteId = await crearCliente()
    await crearPedido(clienteId)

    await expect(sql`delete from clientes where id = ${clienteId}`).rejects.toThrow(
      /foreign key|violates/i,
    )
  })
})

describe('reglas del pedido', () => {
  it('un pedido presencial no admite dirección, vehículo ni fundas', async () => {
    const clienteId = await crearCliente()
    await expect(
      sql`
        insert into pedidos (cliente_id, canal, direccion_recoleccion)
        values (${clienteId}, 'presencial', 'Av. Mariscal Sucre')
      `,
    ).rejects.toThrow(/pedidos_presencial_sin_logistica/i)
  })

  it('rechaza un estado que no está en la lista de los 10', async () => {
    const clienteId = await crearCliente()
    await expect(
      sql`
        insert into pedidos (cliente_id, canal, estado)
        values (${clienteId}, 'whatsapp_agente', 'inventado')
      `,
    ).rejects.toThrow(/pedidos_estado_check/i)
  })

  it('rechaza un teléfono que no está en formato E.164', async () => {
    await expect(
      sql`
        insert into clientes (telefono, canal_origen)
        values ('0987654321', 'presencial')
      `,
    ).rejects.toThrow(/clientes_telefono_check/i)
  })
})
