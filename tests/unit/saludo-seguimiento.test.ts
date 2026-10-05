import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const { PATRON, corregirSaludo } = createRequire(import.meta.url)('../../n8n/generador/saludo.cjs')

/** F1 (2026-10-05): el seguimiento salió con «Buen mediodía» y «Buen día» a deshora. */
describe('saludo del seguimiento según la hora de Quito', () => {
  it('corrige cualquier variante de saludo que el modelo escriba', () => {
    for (const mal of [
      'Buen mediodía',
      'buen día',
      'Buenos días',
      'Buena tarde',
      'BUEN MEDIODIA',
    ]) {
      expect(corregirSaludo(`${mal}, ¿le agendo la recogida?`, 15)).toBe(
        'Buenas tardes, ¿le agendo la recogida?',
      )
    }
  })

  it('cambia de franja a las 12 y a las 19 y no toca el resto del mensaje', () => {
    expect(corregirSaludo('Buenas noches, sigo aquí', 11)).toBe('Buenos días, sigo aquí')
    expect(corregirSaludo('Buenos días, sigo aquí', 12)).toBe('Buenas tardes, sigo aquí')
    expect(corregirSaludo('Buenos días, sigo aquí', 19)).toBe('Buenas noches, sigo aquí')
    expect(corregirSaludo('Hola, sigo aquí', 15)).toBe('Hola, sigo aquí')
  })

  it('n8n y el script de barrido usan el mismo patrón', () => {
    const workflow = readFileSync('n8n/workflows/laundry-vip-agente.json', 'utf8')
    expect(workflow).toContain(PATRON)
    const barrido = readFileSync('scripts/seguimiento-barrido.ts', 'utf8')
    expect(barrido).toContain(`/${PATRON}/i`)
  })
})
