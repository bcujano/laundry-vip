import { describe, expect, it } from 'vitest'
import { CATALOGO } from '../../scripts/catalogo-datos.ts'
import { CANASTAS } from '../../scripts/demo-canastas.ts'
import { CLIENTES_DEMO, PREFIJO_DEMO } from '../../scripts/demo-fuente.ts'

describe('datos de ejemplo del CRM', () => {
  it('cada prenda de ejemplo existe en el catálogo con ese método', () => {
    for (const canasta of Object.values(CANASTAS)) {
      for (const [nombre, metodo] of canasta) {
        const existe = CATALOGO.some(
          (item) => item.nombre_item === nombre && item.metodo === metodo,
        )
        expect(existe, `${nombre} (${metodo})`).toBe(true)
      }
    }
  })

  it('usa un rango de teléfonos propio que no choca con celulares reales ni con las pruebas', () => {
    expect(PREFIJO_DEMO.startsWith('+5939')).toBe(false)
    const telefono = `${PREFIJO_DEMO}${String(CLIENTES_DEMO.length).padStart(4, '0')}`
    expect(telefono).toMatch(/^\+[1-9]\d{7,14}$/)
  })

  it('trae leads que compraron y leads que no', () => {
    expect(CLIENTES_DEMO.some((c) => c.pedidos === 0)).toBe(true)
    expect(CLIENTES_DEMO.some((c) => c.pedidos > 0)).toBe(true)
    expect(CLIENTES_DEMO.some((c) => c.canal === 'presencial')).toBe(true)
  })
})
