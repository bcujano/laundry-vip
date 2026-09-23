import { supabaseAdmin } from '@/lib/supabase/admin'
import type { TipoNegocio } from '@/types/database'

/**
 * Ingresos por período y por tipo de negocio.
 * Se cuenta el monto CONFIRMADO cuando existe; si el pedido todavía no pasó
 * por planta, se usa el estimado y se informa aparte, para no mezclar lo que
 * ya se cobró con lo que apenas se calculó.
 */

export type Periodo = { desde: Date; hasta: Date }

export type FilaReporte = {
  tipo_negocio: TipoNegocio
  pedidos: number
  confirmado_usd: number
  estimado_usd: number
  transporte_usd: number
}

export type Reporte = {
  desde: string
  hasta: string
  total_pedidos: number
  total_confirmado_usd: number
  total_estimado_usd: number
  total_transporte_usd: number
  por_tipo_negocio: FilaReporte[]
  /** Los que la planta todavía no verificó: su monto puede cambiar. */
  pedidos_sin_verificar: number
}

const ESTADOS_QUE_NO_FACTURAN = new Set(['cancelado', 'recoleccion_fallida'])

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

export async function generar(periodo: Periodo): Promise<Reporte> {
  const { data, error } = await supabaseAdmin()
    .from('pedidos')
    .select(
      'id, estado, monto_confirmado_lavado, monto_estimado_lavado, monto_recoleccion_entrega, monto_recoleccion, monto_entrega, cliente:clientes(tipo_negocio)',
    )
    .gte('created_at', periodo.desde.toISOString())
    .lt('created_at', periodo.hasta.toISOString())

  if (error) throw new Error(`No se pudo generar el reporte: ${error.message}`)

  const acumulado = new Map<TipoNegocio, FilaReporte>()
  let sinVerificar = 0

  for (const fila of data ?? []) {
    if (ESTADOS_QUE_NO_FACTURAN.has(fila.estado)) continue

    const tipo = ((fila.cliente as { tipo_negocio?: TipoNegocio } | null)?.tipo_negocio ??
      'otro') as TipoNegocio

    const actual = acumulado.get(tipo) ?? {
      tipo_negocio: tipo,
      pedidos: 0,
      confirmado_usd: 0,
      estimado_usd: 0,
      transporte_usd: 0,
    }

    const confirmado = fila.monto_confirmado_lavado
    actual.pedidos += 1
    if (confirmado !== null) {
      actual.confirmado_usd += Number(confirmado)
    } else {
      actual.estimado_usd += Number(fila.monto_estimado_lavado ?? 0)
      sinVerificar += 1
    }

    actual.transporte_usd +=
      Number(fila.monto_recoleccion_entrega ?? 0) +
      Number(fila.monto_recoleccion ?? 0) +
      Number(fila.monto_entrega ?? 0)

    acumulado.set(tipo, actual)
  }

  const porTipo = [...acumulado.values()]
    .map((fila) => ({
      ...fila,
      confirmado_usd: redondear(fila.confirmado_usd),
      estimado_usd: redondear(fila.estimado_usd),
      transporte_usd: redondear(fila.transporte_usd),
    }))
    .sort((a, b) => b.confirmado_usd - a.confirmado_usd)

  return {
    desde: periodo.desde.toISOString(),
    hasta: periodo.hasta.toISOString(),
    total_pedidos: porTipo.reduce((suma, fila) => suma + fila.pedidos, 0),
    total_confirmado_usd: redondear(porTipo.reduce((s, f) => s + f.confirmado_usd, 0)),
    total_estimado_usd: redondear(porTipo.reduce((s, f) => s + f.estimado_usd, 0)),
    total_transporte_usd: redondear(porTipo.reduce((s, f) => s + f.transporte_usd, 0)),
    por_tipo_negocio: porTipo,
    pedidos_sin_verificar: sinVerificar,
  }
}

/** Períodos que se usan tanto en el CRM como desde WhatsApp. */
export function periodoDesdeNombre(nombre: string, ahora = new Date()): Periodo {
  const hasta = new Date(ahora.getTime() + 24 * 60 * 60 * 1000)
  const dias = nombre === 'hoy' ? 1 : nombre === 'semana' ? 7 : nombre === 'mes' ? 30 : 30
  return { desde: new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000), hasta }
}
