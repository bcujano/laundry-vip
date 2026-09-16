import { describe, expect, it } from 'vitest'
import { resumirEmbudo } from '@/server/dashboard/leads'
import type { Conversacion } from '@/types/database'

const AHORA = new Date('2026-09-16T20:00:00Z') // 15:00 en Quito

function conversacion(
  telefono: string,
  creada: string,
  contexto: Record<string, unknown> = {},
): Conversacion {
  return {
    id: telefono,
    telefono,
    contexto,
    chatwoot_conversation_id: null,
    ultima_interaccion: creada,
    created_at: creada,
  }
}

const cliente = (telefono: string, pedidos: number) => ({
  id: `id-${telefono}`,
  telefono,
  nombre_contacto: null,
  nombre_negocio: null,
  pedidos: [{ count: pedidos }],
})

describe('embudo de leads', () => {
  const conversaciones = [
    conversacion('+593900000001', '2026-09-16T15:00:00Z', { temperatura: 'caliente' }),
    conversacion('+593900000002', '2026-09-10T15:00:00Z', { escalado: true }),
    conversacion('+593900000003', '2026-09-16T14:00:00Z', { nombre_whatsapp: 'Ana' }),
    conversacion('+593900000009', '2026-09-16T16:00:00Z'), // operador
    conversacion('+593900000004', '2026-07-01T15:00:00Z'), // fuera de los 30 días
  ]
  const clientes = [cliente('+593900000001', 0), cliente('+593900000002', 2)]
  const embudo = resumirEmbudo(conversaciones, clientes, new Set(['+593900000009']), AHORA)

  it('cuenta leads hayan pedido o no, sin contar operadores', () => {
    expect(embudo.leads30).toBe(3)
    expect(embudo.leadsHoy).toBe(2)
  })

  it('calcula la conversión a pedido', () => {
    expect(embudo.convertidos30).toBe(1)
    expect(embudo.tasaConversion).toBe(33)
  })

  it('lista los que no han pedido, el más reciente primero', () => {
    expect(embudo.sinPedido.map((lead) => lead.telefono)).toEqual([
      '+593900000001',
      '+593900000003',
      '+593900000004',
    ])
    expect(embudo.sinPedido[1]?.nombre).toBe('Ana')
    expect(embudo.sinPedido[1]?.clienteId).toBeNull()
    expect(embudo.calientesSinPedido).toBe(1)
    expect(embudo.escalados).toBe(1)
  })
})
