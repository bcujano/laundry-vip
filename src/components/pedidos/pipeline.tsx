'use client'

import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { moverEstado } from '@/app/(dashboard)/pedidos/actions'
import { Aviso, type Resultado } from '@/components/ui/primitivos'
import { moneda, soloHora } from '@/lib/format'
import type { EstadoPedido } from '@/types/database'
import { estadoLegible } from './etiquetas'

/**
 * Tablero por etapas. Se arrastra una tarjeta a otra columna para mover el
 * pedido; el servidor sigue validando la transición, así que soltar una
 * tarjeta donde no toca se rechaza con un motivo, no con un salto silencioso.
 */

export type TarjetaPedido = {
  id: string
  cliente: string
  estado: EstadoPedido
  monto: number | null
  ventana: string | null
  discrepancia: boolean
}

/** Las etapas vivas. Los estados finales no ocupan columna en el tablero. */
const COLUMNAS: EstadoPedido[] = [
  'nuevo',
  'esperando_pago_para_recoleccion',
  'recolectado',
  'en_proceso',
  'discrepancia_detectada',
  'esperando_pago_para_entrega',
  'listo_para_entrega',
  'entregado',
]

export function Pipeline({ pedidos }: { pedidos: TarjetaPedido[] }) {
  const [estado, setEstado] = useState<Resultado>({})
  const [, iniciar] = useTransition()
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [encima, setEncima] = useState<EstadoPedido | null>(null)

  function soltar(destino: EstadoPedido) {
    const id = arrastrando
    setArrastrando(null)
    setEncima(null)
    if (!id) return

    const pedido = pedidos.find((p) => p.id === id)
    if (!pedido || pedido.estado === destino) return

    iniciar(async () => setEstado(await moverEstado(id, destino)))
  }

  return (
    <div className="flex flex-col gap-3">
      <Aviso estado={estado} />

      {/* Móvil: columnas deslizables de lado. Escritorio: todas a la vista, sin scroll lateral
          (dos filas de 4 en pantallas medianas, una fila de 8 en las anchas). */}
      <div className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 lg:mx-0 lg:snap-none lg:overflow-visible lg:px-0">
        <div className="flex min-w-max gap-3 pb-2 lg:grid lg:min-w-0 lg:grid-cols-4 lg:gap-2 2xl:grid-cols-8">
          {COLUMNAS.map((columna) => {
            const delColumna = pedidos.filter((pedido) => pedido.estado === columna)
            const total = delColumna.reduce((suma, pedido) => suma + (pedido.monto ?? 0), 0)

            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: zona de soltado del tablero
              <div
                className={`columna-pipeline w-[78vw] max-w-72 shrink-0 snap-start rounded-xl border p-2 transition-colors sm:w-64 lg:w-auto lg:max-w-none lg:min-w-0 ${
                  encima === columna
                    ? 'border-[var(--primario)] bg-[var(--exito-suave)]'
                    : 'border-[var(--borde)] bg-[var(--superficie)]'
                }`}
                key={columna}
                onDragLeave={() => setEncima((actual) => (actual === columna ? null : actual))}
                onDragOver={(evento) => {
                  evento.preventDefault()
                  setEncima(columna)
                }}
                onDrop={() => soltar(columna)}
              >
                <div className="mb-2 flex items-baseline justify-between gap-1 px-1">
                  <p
                    className="min-w-0 truncate font-semibold text-xs"
                    title={estadoLegible(columna)}
                  >
                    {estadoLegible(columna)}
                  </p>
                  <span className="text-[var(--texto-suave)] text-xs tabular-nums">
                    {delColumna.length}
                  </span>
                </div>
                {total > 0 ? (
                  <p className="mb-2 px-1 text-[var(--texto-suave)] text-xs tabular-nums">
                    {moneda(total)}
                  </p>
                ) : null}

                <div className="space-y-2">
                  {delColumna.map((pedido) => (
                    <Link
                      className={`tarjeta-arrastrable block rounded-lg border border-[var(--borde)] bg-[var(--fondo)] p-2.5 ${
                        arrastrando === pedido.id ? 'opacity-40' : ''
                      }`}
                      draggable
                      href={`/pedidos/${pedido.id}`}
                      key={pedido.id}
                      onDragEnd={() => setArrastrando(null)}
                      onDragStart={() => setArrastrando(pedido.id)}
                    >
                      <p className="truncate font-medium text-sm" title={pedido.cliente}>
                        {pedido.cliente}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2">
                        <span className="text-[var(--texto-suave)] text-xs tabular-nums">
                          {pedido.ventana ? soloHora(pedido.ventana) : 'sin ventana'}
                        </span>
                        <span className="font-medium text-xs tabular-nums">
                          {moneda(pedido.monto)}
                        </span>
                      </div>
                      {pedido.discrepancia ? (
                        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--peligro)]">
                          <AlertTriangle size={11} /> congelado
                        </p>
                      ) : null}
                    </Link>
                  ))}

                  {delColumna.length === 0 ? (
                    <p className="px-1 py-6 text-center text-[var(--texto-suave)] text-xs">Vacío</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[var(--texto-suave)] text-xs">
        Arrastra una tarjeta a otra columna para mover el pedido. Un pedido congelado por
        discrepancia solo se puede cancelar hasta que la cierres.
      </p>
    </div>
  )
}
