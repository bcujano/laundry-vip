import { conectar } from './db-conexion.ts'

const sql = conectar()
await sql`delete from mensajes_diarios where telefono = '+59322000771'`
await sql.end()
