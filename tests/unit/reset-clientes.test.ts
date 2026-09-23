import { describe, expect, it } from 'vitest'
import { TABLAS_A_VACIAR, TABLAS_INTOCABLES } from '../../scripts/reset-clientes.ts'
import { TABLAS } from '../../src/types/database.ts'

/**
 * La prueba NO corre el borrado: sería borrar la base real. Verifica la lista,
 * que es donde un descuido costaría caro.
 */
describe('puesta a cero de la base de clientes', () => {
  it('no vacía el catálogo, la configuración, el staff ni la lista blanca', () => {
    for (const intocable of TABLAS_INTOCABLES) {
      expect(TABLAS_A_VACIAR as readonly string[]).not.toContain(intocable)
    }
  })

  it('borra los pedidos antes que los clientes, que es lo que exige la FK', () => {
    const orden = TABLAS_A_VACIAR as readonly string[]
    expect(orden.indexOf('pedidos')).toBeLessThan(orden.indexOf('clientes'))
    for (const hija of ['pedido_items', 'pedido_eventos', 'correcciones_cotizacion']) {
      expect(orden.indexOf(hija)).toBeLessThan(orden.indexOf('pedidos'))
    }
  })

  it('limpia también la memoria del agente, no solo el CRM', () => {
    expect(TABLAS_A_VACIAR as readonly string[]).toContain('n8n_laundry_chat_histories')
    expect(TABLAS_A_VACIAR as readonly string[]).toContain('conversaciones')
  })

  it('cada tabla del esquema o se vacía o es intocable a propósito', () => {
    const decididas = new Set<string>([...TABLAS_A_VACIAR, ...TABLAS_INTOCABLES])
    // Si mañana nace una tabla, esta prueba obliga a decidir de qué lado cae.
    expect(TABLAS.filter((t) => !decididas.has(t))).toEqual([])
  })
})
