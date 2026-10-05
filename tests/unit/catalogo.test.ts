import { describe, expect, it } from 'vitest'
import { agruparCatalogo, cabeEnUnaLinea, repartirEnColumnas } from '@/server/catalogo/agrupar'

const fila = (sobre: Record<string, unknown>) => ({
  categoria: 'Camisas y blusas',
  nombre_item: 'Camiseta',
  metodo: 'agua' as const,
  unidad: 'pieza' as const,
  precio_min: 2.25,
  precio_max: 2.25,
  cantidad_por_paquete: null,
  precio_paquete: null,
  ...sobre,
})

describe('catálogo en imagen: lo que se agrupa y cómo se escribe', () => {
  it('junta los métodos de una misma prenda en una fila, ordenados', () => {
    const [cat] = agruparCatalogo([
      fila({ metodo: 'seco', precio_min: 2.5, precio_max: 2.5 }),
      fila({}),
    ])
    expect(cat?.filas).toEqual([{ nombre: 'Camiseta', detalle: 'en agua $2,25 · en seco $2,50' }])
  })

  it('escribe la unidad, los rangos y las promociones por cantidad', () => {
    const [libra, peluche, cobijas] = agruparCatalogo([
      fila({
        categoria: 'A',
        nombre_item: 'Lavado',
        unidad: 'libra',
        precio_min: 0.7,
        precio_max: 0.7,
      }),
      fila({ categoria: 'B', nombre_item: 'Peluche', precio_min: 5, precio_max: 7 }),
      fila({
        categoria: 'C',
        nombre_item: 'Cobijas',
        precio_min: 5,
        precio_max: 5,
        cantidad_por_paquete: 3,
        precio_paquete: 12,
      }),
    ])
    expect(libra?.filas[0]?.detalle).toBe('$0,70 por libra')
    expect(peluche?.filas[0]?.detalle).toBe('$5,00 a $7,00')
    expect(cobijas?.filas[0]?.detalle).toBe('$5,00 c/u · 3 por $12,00')
  })

  it('lo principal va primero y el resto en orden alfabético', () => {
    const titulos = agruparCatalogo([
      fila({ categoria: 'Peluches', nombre_item: 'P' }),
      fila({ categoria: 'Lavado en agua', nombre_item: 'L' }),
      fila({ categoria: 'Alfombras', nombre_item: 'A' }),
    ]).map((c) => c.titulo)
    expect(titulos).toEqual(['Lavado en agua', 'Alfombras', 'Peluches'])
  })

  it('reparte en dos columnas parecidas sin partir ninguna categoría', () => {
    const categorias = ['A', 'B', 'C', 'D'].map((t) => ({
      titulo: t,
      filas: Array.from({ length: 4 }, (_, i) => ({ nombre: `Prenda ${i}`, detalle: '$3,00' })),
    }))
    const { columnas } = repartirEnColumnas(categorias, 2)
    expect(columnas.map((c) => c.length)).toEqual([2, 2])
    expect(columnas.flat().map((c) => c.titulo)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('una fila corta va en un solo renglón y una larga en dos', () => {
    expect(cabeEnUnaLinea({ nombre: 'Chal', detalle: '$3,00' })).toBe(true)
    expect(
      cabeEnUnaLinea({
        nombre: 'Pantalón que no es de terno',
        detalle: 'en agua $2,25 · en seco $2,50',
      }),
    ).toBe(false)
  })
})
