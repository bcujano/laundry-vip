import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { conectar } from './db-conexion.ts'
import { type FilaHoja, prepararProspectos, SEGMENTOS_DE_TRABAJO } from './prospectos-datos.ts'
import {
  type CoberturaProspecto,
  clasificarDistancia,
  distanciaKm,
  ubicar,
} from './prospectos-ubicar.ts'

/**
 * Carga la lista de ProspectorVIP como prospectos del CRM.
 *
 *   python scripts/prospectos_xlsx_a_json.py "ProspectorVIP LAUNDRY.xlsx" prospectos.json
 *   pnpm db:prospectos prospectos.json                 # SIMULA: no escribe nada
 *   pnpm db:prospectos prospectos.json --confirmar     # escribe
 *
 * Opciones: --segmentos "catering,hogares de ancianos" (por defecto los 7 que marcó el dueño),
 * --fuente "ProspectorVIP 2026-10-19", --sin-ubicar (no consulta OpenStreetMap).
 *
 * Es idempotente: importar dos veces la misma hoja no duplica (fuente + número de la hoja). No toca
 * a quien ya es cliente, ya le escribió al agente o es del equipo: esos no son prospectos.
 * La ubicación se consulta a OpenStreetMap a 1 por segundo y se guarda junto al JSON para no repetirla.
 */

const PAUSA_ENTRE_CONSULTAS_MS = 1100

function opcion(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const bandera = (nombre: string) => process.argv.includes(`--${nombre}`)

const archivo = process.argv[2]
if (!archivo || archivo.startsWith('--')) {
  console.error('Uso: pnpm db:prospectos <prospectos.json> [--confirmar] [--sin-ubicar]')
  process.exit(2)
}

const confirmar = bandera('confirmar')
const fuente = opcion('fuente') ?? `ProspectorVIP ${new Date().toISOString().slice(0, 10)}`
const segmentos = opcion('segmentos')
  ?.split(',')
  .map((s) => s.trim()) ?? [...SEGMENTOS_DE_TRABAJO]

const { prospectos, descartados } = prepararProspectos(
  JSON.parse(readFileSync(archivo, 'utf8')) as FilaHoja[],
  { segmentos, fuente },
)

const sql = conectar()
try {
  const [config] = await sql<{ radio: string; lat: string; lng: string }[]>`
    select radio_cobertura_km::text as radio, local_latitud::text as lat, local_longitud::text as lng
    from configuracion where id = 1`
  if (!config) throw new Error('No hay fila de configuración.')
  const planta = { lat: Number(config.lat), lng: Number(config.lng) }
  const radio = Number(config.radio)

  // Quien ya nos conoce no es un prospecto: se le atiende, no se le escribe en frío.
  const conocidos = new Set(
    (
      await sql<{ telefono: string }[]>`
        select telefono from clientes
        union select telefono from conversaciones
        union select telefono from operador_whitelist`
    ).map((f) => f.telefono),
  )
  const yaImportados = new Set(
    (
      await sql<
        { fuente_ref: string }[]
      >`select fuente_ref from prospectos where fuente = ${fuente}`
    ).map((f) => f.fuente_ref),
  )

  const porImportar = prospectos.filter((p) => {
    if (yaImportados.has(p.fuente_ref)) {
      descartados.push({ nombre: p.nombre, motivo: 'ya estaba importado' })
      return false
    }
    if (p.telefono && conocidos.has(p.telefono)) {
      descartados.push({ nombre: p.nombre, motivo: 'ya es cliente, lead o del equipo' })
      return false
    }
    return true
  })

  // ── Ubicación (OpenStreetMap, con caché en disco) ──────────────────────────────
  const rutaCache = `${archivo}.ubicaciones.json`
  const cache: Record<string, { cobertura: CoberturaProspecto; km: number | null }> = existsSync(
    rutaCache,
  )
    ? JSON.parse(readFileSync(rutaCache, 'utf8'))
    : {}

  if (!bandera('sin-ubicar')) {
    let consultas = 0
    for (const p of porImportar) {
      if (cache[p.fuente_ref] || !p.direccion) continue
      const sitio = await ubicar(p.direccion)
      cache[p.fuente_ref] = sitio
        ? (() => {
            const km = Math.round(distanciaKm(planta, sitio.punto) * 100) / 100
            return { cobertura: clasificarDistancia(km, radio, sitio.preciso), km }
          })()
        : { cobertura: 'sin_ubicar', km: null }
      writeFileSync(rutaCache, JSON.stringify(cache), 'utf8')
      if (++consultas % 10 === 0) console.log(`  ubicados ${consultas}…`)
      await new Promise((r) => setTimeout(r, PAUSA_ENTRE_CONSULTAS_MS))
    }
  }

  const filas = porImportar.map((p) => ({
    ...p,
    cobertura: cache[p.fuente_ref]?.cobertura ?? 'sin_ubicar',
    distancia_km: cache[p.fuente_ref]?.km ?? null,
  }))

  // ── Resumen ────────────────────────────────────────────────────────────────────
  const contar = (clave: (f: (typeof filas)[number]) => string) => {
    const cuenta = new Map<string, number>()
    for (const f of filas) cuenta.set(clave(f), (cuenta.get(clave(f)) ?? 0) + 1)
    return [...cuenta]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `    ${String(v).padStart(3)}  ${k}`)
  }
  console.log(
    `\n${confirmar ? 'IMPORTANDO' : 'SIMULACIÓN (no se escribe nada)'} · fuente «${fuente}»`,
  )
  console.log(`  segmentos: ${segmentos.join(' | ')}`)
  console.log(`  radio de recolección: ${radio} km desde (${planta.lat}, ${planta.lng})`)
  console.log(`\n  A importar: ${filas.length}`)
  console.log(`  por segmento:\n${contar((f) => f.segmento).join('\n')}`)
  console.log(`  por teléfono:\n${contar((f) => f.tipo_telefono).join('\n')}`)
  console.log(`  por cobertura:\n${contar((f) => f.cobertura).join('\n')}`)
  if (descartados.length > 0) {
    console.log(`\n  Descartados (${descartados.length}):`)
    for (const d of descartados) console.log(`    - ${d.nombre}: ${d.motivo}`)
  }

  if (!confirmar) {
    console.log('\nPara escribir de verdad: añade --confirmar')
  } else if (filas.length > 0) {
    const resultado = await sql`
      insert into prospectos ${sql(
        filas,
        'nombre',
        'segmento',
        'telefono',
        'tipo_telefono',
        'telefono_original',
        'direccion',
        'email',
        'sitio_web',
        'instagram',
        'google_maps',
        'rating',
        'resenas',
        'cobertura',
        'distancia_km',
        'notas',
        'fuente',
        'fuente_ref',
      )}
      on conflict (fuente, fuente_ref) do nothing`
    console.log(`\nEscritos: ${resultado.count} prospectos.`)
  }
} finally {
  await sql.end()
}
