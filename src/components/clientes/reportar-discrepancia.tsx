'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useActionState, useEffect, useRef } from 'react'
import { corregirCotizacionAccion, type EstadoAccion } from '@/app/(dashboard)/pedidos/[id]/actions'
import { Aviso, Boton, Campo } from '@/components/ui/primitivos'
import { moneda } from '@/lib/format'

/**
 * Reportar una discrepancia desde la ficha del cliente, sin entrar al pedido.
 * Es la misma corrección de cotización del detalle: deja rastro del monto
 * anterior, congela el pedido y obliga a avisar al cliente antes de cobrar.
 */
export function ReportarDiscrepancia({
  pedidoId,
  vigente,
}: {
  pedidoId: string
  vigente: number | null
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(
    corregirCotizacionAccion.bind(null, pedidoId),
    {},
  )

  useEffect(() => {
    if (estado.ok) dialogo.current?.close()
  }, [estado])

  return (
    <>
      <button
        className="inline-flex items-center gap-1 text-[var(--peligro)] text-sm hover:underline"
        onClick={() => dialogo.current?.showModal()}
        type="button"
      >
        <AlertTriangle size={13} /> Discrepancia
      </button>

      <dialog
        className="m-auto w-[min(92vw,28rem)] rounded-xl border border-[var(--borde)] bg-[var(--superficie)] p-0 text-[var(--texto)] backdrop:bg-black/40"
        ref={dialogo}
      >
        <form action={accion} className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">Reportar discrepancia</h2>
              <p className="text-[var(--texto-suave)] text-xs">
                El pedido queda congelado hasta que el cliente acepte el monto nuevo.
              </p>
            </div>
            <button
              aria-label="Cerrar"
              className="text-[var(--texto-suave)] hover:text-[var(--texto)]"
              onClick={() => dialogo.current?.close()}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <label className="flex flex-col gap-1 text-sm" htmlFor={`monto-${pedidoId}`}>
            <span className="font-medium">Monto correcto (vigente: {moneda(vigente)})</span>
            <Campo
              defaultValue={vigente !== null ? Number(vigente).toFixed(2) : ''}
              id={`monto-${pedidoId}`}
              min="0"
              name="monto"
              required
              step="0.01"
              type="number"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm" htmlFor={`motivo-${pedidoId}`}>
            <span className="font-medium">Motivo</span>
            <Campo
              id={`motivo-${pedidoId}`}
              name="motivo"
              placeholder="Declararon 12 manteles y llegaron 10"
              required
            />
          </label>

          <Aviso estado={estado} />

          <div className="flex justify-end gap-2">
            <Boton onClick={() => dialogo.current?.close()} type="button" variante="suave">
              Cancelar
            </Boton>
            <Boton disabled={pendiente} type="submit" variante="peligro">
              {pendiente ? 'Guardando…' : 'Congelar y corregir'}
            </Boton>
          </div>
        </form>
      </dialog>
    </>
  )
}
