import { describe, expect, it } from 'vitest'
import { type FilaPedido, mesDe, movimiento } from '@/server/reportes/negocio'

/**
 * La aritmética de la radiografía que el agente le da a la dueña, probada sin
 * tocar la base: así es determinista y no compite con las demás pruebas, que
 * crean y borran pedidos en paralelo sobre la misma base.
 */

const PERIODO = mesDe(new Date('2026-09-23T22:00:00.000Z'))

function pedido(estado: string, confirmado: number | null, estimado: number | null): FilaPedido {
  return {
    created_at: '2026-09-10T15:00:00.000Z',
    estado,
    monto_confirmado_lavado: confirmado,
    monto_estimado_lavado: estimado,
    cliente_id: 'c1',
  }
}

describe('mes calendario de Quito', () => {
  it('va del día 1 a las 00:00 de Quito, que es 05:00 UTC', () => {
    expect(PERIODO.desde.toISOString()).toBe('2026-09-01T05:00:00.000Z')
    expect(PERIODO.hasta.toISOString()).toBe('2026-10-01T05:00:00.000Z')
  })

  it('el mes anterior pega con el actual y cruza el año sin romperse', () => {
    const ahora = new Date('2026-01-05T12:00:00.000Z')
    expect(mesDe(ahora, -1).hasta.toISOString()).toBe(mesDe(ahora).desde.toISOString())
    expect(mesDe(ahora, -1).desde.toISOString()).toBe('2025-12-01T05:00:00.000Z')
  })

  it('la madrugada de Quito todavía es el mes anterior', () => {
    // 2026-10-01T03:00Z son las 22:00 del 30 de septiembre en Quito.
    expect(mesDe(new Date('2026-10-01T03:00:00.000Z')).desde.toISOString()).toBe(
      '2026-09-01T05:00:00.000Z',
    )
  })
})

describe('lo que deja un mes', () => {
  it('usa el monto confirmado y, si no hay, el estimado', () => {
    const datos = movimiento([pedido('entregado', 20, 18), pedido('en_proceso', null, 10)], PERIODO)
    expect(datos.facturado_usd).toBe(30)
    expect(datos.pedidos).toBe(2)
    expect(datos.ticket_promedio_usd).toBe(15)
  })

  it('no cuenta como venta lo cancelado ni la recolección fallida', () => {
    const datos = movimiento(
      [
        pedido('entregado', 20, null),
        pedido('cancelado', 999, null),
        pedido('recoleccion_fallida', 500, null),
      ],
      PERIODO,
    )
    expect(datos.facturado_usd).toBe(20)
    expect(datos.pedidos).toBe(1)
  })

  it('sin pedidos el ticket promedio es null, nunca 0', () => {
    // Un 0 se leería como «vendimos cero por pedido», que es otra mentira.
    const datos = movimiento([], PERIODO)
    expect(datos.pedidos).toBe(0)
    expect(datos.facturado_usd).toBe(0)
    expect(datos.ticket_promedio_usd).toBeNull()
  })

  it('redondea a centavos, sin arrastrar decimales del flotante', () => {
    const datos = movimiento(
      [pedido('entregado', 0.1, null), pedido('entregado', 0.2, null)],
      PERIODO,
    )
    expect(datos.facturado_usd).toBe(0.3)
    expect(datos.ticket_promedio_usd).toBe(0.15)
  })
})
