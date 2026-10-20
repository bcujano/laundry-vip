import { cargarEntorno, conectar } from './db-conexion.ts'
import {
  clasificarDistancia,
  distanciaKm,
  probarLlaveGoogle,
  ubicar,
  ubicarConGoogle,
} from './prospectos-ubicar.ts'

/**
 * Vuelve a ubicar a los prospectos «sin ubicar» (o a todos, con --todos). Con la llave de Google
 * arreglada acierta casi todo; sin ella usa OpenStreetMap, que falla con muchas calles de Quito.
 *
 *   pnpm db:prospectos-ubicar              # SIMULA
 *   pnpm db:prospectos-ubicar --confirmar  # escribe cobertura y distancia
 *   pnpm db:prospectos-ubicar --todos      # revisa también a los ya ubicados
 *
 * Solo toca `cobertura` y `distancia_km`; no cambia la etapa ni escribe a nadie.
 */
cargarEntorno()
const confirmar = process.argv.includes('--confirmar')
const todos = process.argv.includes('--todos')
const llave = (process.env.GOOGLE_MAPS_API_KEY ?? '').trim()

let usarGoogle = false
if (llave) {
  const problema = await probarLlaveGoogle(llave)
  if (problema) console.log(`Google no sirve todavía (${problema}). Se usa OpenStreetMap.`)
  else usarGoogle = true
} else {
  console.log('No hay GOOGLE_MAPS_API_KEY. Se usa OpenStreetMap.')
}
console.log(`Proveedor: ${usarGoogle ? 'Google Maps' : 'OpenStreetMap'}`)

const sql = conectar()
try {
  const [config] = await sql<{ radio: string; lat: string; lng: string }[]>`
    select radio_cobertura_km::text as radio, local_latitud::text as lat, local_longitud::text as lng
    from configuracion where id = 1`
  if (!config) throw new Error('No hay fila de configuración.')
  const planta = { lat: Number(config.lat), lng: Number(config.lng) }
  const radio = Number(config.radio)

  const filas = await sql<
    { id: string; nombre: string; direccion: string | null; cobertura: string }[]
  >`
    select id, nombre, direccion, cobertura from prospectos
    where direccion is not null and (${todos} or cobertura = 'sin_ubicar')
    order by nombre`
  console.log(`${filas.length} prospectos por ubicar · radio ${radio} km`)

  const cambios = new Map<string, number>()
  for (const f of filas) {
    const sitio = f.direccion
      ? usarGoogle
        ? await ubicarConGoogle(f.direccion, llave)
        : await ubicar(f.direccion)
      : null
    if (!sitio) continue
    const km = Math.round(distanciaKm(planta, sitio.punto) * 100) / 100
    const cobertura = clasificarDistancia(km, radio, sitio.preciso)
    cambios.set(cobertura, (cambios.get(cobertura) ?? 0) + 1)
    if (confirmar)
      await sql`update prospectos set cobertura = ${cobertura}, distancia_km = ${km} where id = ${f.id}`
    await new Promise((r) => setTimeout(r, usarGoogle ? 120 : 1100))
  }
  console.log(`${confirmar ? 'Actualizados' : 'Se actualizarían'}:`)
  for (const [c, n] of cambios) console.log(`  ${String(n).padStart(3)}  ${c}`)
  if (!confirmar) console.log('Para escribir de verdad: añade --confirmar')
} finally {
  await sql.end()
}
