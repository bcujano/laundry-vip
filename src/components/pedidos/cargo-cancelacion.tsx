'use client'

import { pedirDevolucionAccion } from '@/app/(dashboard)/pedidos/[id]/actions'
import { BotonAccion } from '@/components/ui/primitivos'
import { moneda } from '@/lib/format'
import type { Pedido } from '@/types/database'

/**
 * Cargo por cancelar con la ropa ya recogida: un tramo si la retira en planta, dos si pide que se
 * la devuelvan. El cargo se cobra en el CRM, nunca por WhatsApp.
 */
export function CargoCancelacion({ pedido }: { pedido: Pedido }) {
  if (pedido.estado !== 'cancelado') return null
  if (pedido.monto_cancelacion === null) {
    return (
      <p className="p-4 text-[var(--color-texto-apagado)] text-sm">
        Cancelado sin cargo: la ropa no se había recogido o el cliente la traía él mismo.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3 p-4 text-sm">
      <p>
        Cargo por cancelación:{' '}
        <strong className="tabular-nums">{moneda(pedido.monto_cancelacion)}</strong>{' '}
        {pedido.cancelacion_con_devolucion
          ? '(recogida + devolución a domicilio)'
          : '(solo la recogida: el cliente retira su ropa en planta)'}
      </p>
      {pedido.cancelacion_con_devolucion ? null : (
        <BotonAccion
          confirmacion="¿El cliente pidió que le devuelvan la ropa a domicilio? El cargo pasa a recogida + devolución."
          onEjecutar={() => pedirDevolucionAccion(pedido.id)}
          texto="Pidió que se la devuelvan (suma el tramo de devolución)"
        />
      )}
    </div>
  )
}
