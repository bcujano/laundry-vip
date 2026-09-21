import { afterAll, describe, expect, it } from 'vitest'
import {
  actualizarPrecio,
  contar,
  crear,
  listarPorCategoria,
  obtener,
} from '@/server/servicios/repo'

// Las categorías de la lista física del dueño (`catalogo_lavanderia.xlsx`).
const CATEGORIAS_ESPERADAS = [
  'Alfombras',
  'Calzado',
  'Camisas y blusas',
  'Cortinas',
  'Lavado en agua',
  'Mantelería',
  'Mochilas',
  'Otros',
  'Peluches',
  'Prendas de vestir',
  'Ropa de cama',
  'Trajes y abrigos',
  'Vestidos especiales',
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

  it('agrupa las 9 prendas de vestir', async () => {
    const grupos = await listarPorCategoria()
    const vestir = grupos.find((g) => g.categoria === 'Prendas de vestir')
    expect(vestir?.items).toHaveLength(9)
  })

  it('las cobijas pequeñas llevan la promoción 3 x 12.00', async () => {
    const grupos = await listarPorCategoria()
    const cobijas = grupos
      .flatMap((g) => g.items)
      .find((item) => item.nombre_item === 'Cobijas pequeñas')

    expect(Number(cobijas?.precio_min)).toBe(5)
    expect(cobijas?.cantidad_por_paquete).toBe(3)
    expect(Number(cobijas?.precio_paquete)).toBe(12)
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
      precio_paquete: null,
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
