import { afterAll, describe, expect, it } from 'vitest'
import {
  actualizarPrecio,
  contar,
  crear,
  listarPorCategoria,
  obtener,
} from '@/server/servicios/repo'

const CATEGORIAS_ESPERADAS = [
  'Alfombras',
  'Cortinas',
  'Doble y triple método',
  'Hogar y otros',
  'Lavado en seco',
  'Ropa suelta',
]

let precioOriginal: { id: string; min: number; max: number } | null = null

afterAll(async () => {
  // Las pruebas escriben sobre el catálogo real: se deja como estaba.
  if (precioOriginal) {
    await actualizarPrecio(precioOriginal.id, precioOriginal.min, precioOriginal.max)
  }
})

describe('catálogo en pantalla', () => {
  it('lista las 54 filas agrupadas por categoría', async () => {
    const grupos = await listarPorCategoria()
    const total = grupos.reduce((suma, grupo) => suma + grupo.items.length, 0)

    expect(total).toBe(54)
    expect(await contar()).toBe(54)
    expect(grupos.map((g) => g.categoria).sort()).toEqual(CATEGORIAS_ESPERADAS)
  })

  it('agrupa las 24 prendas de lavado en seco', async () => {
    const grupos = await listarPorCategoria()
    const seco = grupos.find((g) => g.categoria === 'Lavado en seco')
    expect(seco?.items).toHaveLength(24)
  })
})

describe('edición de precios', () => {
  it('un precio editado persiste', async () => {
    const grupos = await listarPorCategoria()
    const chal = grupos.flatMap((g) => g.items).find((item) => item.nombre_item === 'Chal')
    if (!chal) throw new Error('No se encontró el ítem de prueba')

    precioOriginal = { id: chal.id, min: Number(chal.precio_min), max: Number(chal.precio_max) }

    const resultado = await actualizarPrecio(chal.id, 3.25, 3.25)
    expect(resultado.ok).toBe(true)

    const releido = await obtener(chal.id)
    expect(Number(releido?.precio_min)).toBe(3.25)
    expect(Number(releido?.precio_max)).toBe(3.25)
  })

  it('rechaza un precio negativo sin tocar la base', async () => {
    const grupos = await listarPorCategoria()
    const item = grupos[0]?.items[0]
    if (!item) throw new Error('catálogo vacío')

    const resultado = await actualizarPrecio(item.id, -1, -1)
    expect(resultado).toEqual({ ok: false, error: 'Un precio no puede ser negativo.' })

    const releido = await obtener(item.id)
    expect(Number(releido?.precio_min)).toBe(Number(item.precio_min))
  })

  it('rechaza un máximo menor que el mínimo', async () => {
    const grupos = await listarPorCategoria()
    const item = grupos[0]?.items[0]
    if (!item) throw new Error('catálogo vacío')

    const resultado = await actualizarPrecio(item.id, 10, 5)
    expect(resultado.ok).toBe(false)
  })
})

describe('alta de servicios', () => {
  it('rechaza un duplicado con un mensaje entendible', async () => {
    const resultado = await crear({
      categoria: 'Alfombras',
      nombre_item: 'Alfombra de pelo corto',
      metodo: 'unico',
      unidad: 'm2',
      precio_min: 7,
      precio_max: 7,
      cantidad_por_paquete: null,
      requiere_seleccion_metodo: false,
    })

    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.error).toContain('Ya existe')
      expect(resultado.error).not.toContain('duplicate key')
    }
    expect(await contar()).toBe(54)
  })
})
