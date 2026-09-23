import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Ningún secreto en el repo, y no solo en el workflow de Lavandería: el JSON
 * de referencia de 321 traía una credencial literal dentro y estuvo versionado
 * meses. Esta prueba mira TODO lo que git tiene rastreado.
 */
const RAIZ = resolve(import.meta.dirname, '../..')

/** Lo que de verdad es una llave, no cualquier cadena larga. */
const PATRONES: [string, RegExp][] = [
  ['llave de OpenAI', /sk-[A-Za-z0-9_-]{20,}/],
  ['token de Meta', /EAA[A-Za-z0-9]{30,}/],
  ['JWT (Supabase, Vercel…)', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ['credencial en un nodo de n8n', /"value"\s*:\s*"[A-Za-z0-9_-]{25,}"/],
]

const EXTENSIONES = /\.(json|ts|tsx|cjs|mjs|js|md|sql|ya?ml)$/

function archivosRastreados(): string[] {
  const salida = execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8' })
  return salida.split('\n').filter((linea) => linea !== '' && EXTENSIONES.test(linea))
}

describe('el repo no guarda secretos', () => {
  it('ningún archivo rastreado trae una llave literal', () => {
    const hallazgos: string[] = []

    for (const archivo of archivosRastreados()) {
      // El ejemplo de entorno existe justamente para mostrar los nombres.
      if (archivo === '.env.example') continue
      const contenido = readFileSync(resolve(RAIZ, archivo), 'utf8')
      for (const [nombre, patron] of PATRONES) {
        if (patron.test(contenido)) hallazgos.push(`${archivo}: ${nombre}`)
      }
    }

    expect(hallazgos, `Saca esto del repo antes de subirlo:\n${hallazgos.join('\n')}`).toEqual([])
  })

  it('el .env.local nunca está rastreado', () => {
    expect(archivosRastreados()).not.toContain('.env.local')
  })
})
