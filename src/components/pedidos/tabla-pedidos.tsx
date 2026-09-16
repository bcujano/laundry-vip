'use client'

import { ArrowRight, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { borrarPedido } from '@/app/(dashboard)/pedidos/actions'
import { BotonAccion, Tabla, Td, Th } from '@/components/ui/primitivos'
import { moneda, soloHora, telefonoLegible } from '@/lib/format'
import type { PedidoConCliente } from '@/server/pedidos/repo'
import { canalLegible, EtiquetaEstado } from './etiquetas'

function nombreCliente(pedido: PedidoConCliente): string {
  const cliente = pedido.cliente
  if (!cliente) return 'Cliente eliminado'
  return cliente.nombre_negocio || cliente.nombre_contacto || telefonoLegible(cliente.telefono)
}

/** El monto que manda es el confirmado por la planta; el estimado es tentativo. */
function montoLavado(pedido: PedidoConCliente): string {
  if (pedido.monto_confirmado_lavado !== null) return moneda(pedido.monto_confirmado_lavado)
  if (pedido.monto_estimado_lavado !== null) return `${moneda(pedido.monto_estimado_lavado)} est.`
  return '—'
}

export function TablaPedidos({
  pedidos,
  mostrarHora = false,
  puedeBorrar = false,
}: {
  pedidos: PedidoConCliente[]
  mostrarHora?: boolean
  puedeBorrar?: boolean
}) {
  return (
    <Tabla>
      <thead>
        <tr>
          {mostrarHora ? <Th>Hora</Th> : null}
          <Th>Cliente</Th>
          <Th>Estado</Th>
          <Th className="hidden sm:table-cell">Canal</Th>
          <Th className="hidden lg:table-cell">Logística</Th>
          <Th>Lavado</Th>
          <Th> </Th>
        </tr>
      </thead>
      <tbody>
        {pedidos.map((pedido) => {
          const esPresencial = pedido.canal === 'presencial'
          return (
            <tr
              className={pedido.estado === 'nuevo' ? 'bg-[var(--exito-suave)]/40' : ''}
              key={pedido.id}
            >
              {mostrarHora ? (
                <Td className="tabular-nums">{soloHora(pedido.ventana_recoleccion_inicio)}</Td>
              ) : null}
              <Td>
                <Link className="hover:underline" href={`/pedidos/${pedido.id}`}>
                  {nombreCliente(pedido)}
                </Link>
              </Td>
              <Td>
                <EtiquetaEstado estado={pedido.estado} />
                {pedido.discrepancia_detectada ? (
                  <span className="ml-1 text-[var(--peligro)] text-xs" title="Discrepancia abierta">
                    ⚠
                  </span>
                ) : null}
              </Td>
              <Td className="hidden text-[var(--texto-suave)] sm:table-cell">
                {canalLegible(pedido.canal)}
              </Td>
              <Td className="hidden text-[var(--texto-suave)] lg:table-cell">
                {/* Un pedido presencial no tiene logística: el cliente vino al local. */}
                {esPresencial
                  ? '—'
                  : [
                      pedido.direccion_recoleccion,
                      pedido.vehiculo_sugerido,
                      pedido.numero_fundas ? `${pedido.numero_fundas} funda(s)` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
              </Td>
              <Td className="tabular-nums">{montoLavado(pedido)}</Td>
              <Td>
                <span className="flex items-center justify-end gap-2">
                  {puedeBorrar ? (
                    <BotonAccion
                      confirmacion={`¿Borrar el pedido de ${nombreCliente(pedido)}? Se borran también sus prendas y su historial. No se puede deshacer.`}
                      icono={<Trash2 size={14} />}
                      onEjecutar={() => borrarPedido(pedido.id)}
                      texto=""
                      variante="peligro"
                    />
                  ) : null}
                  <Link
                    aria-label={`Ver el pedido de ${nombreCliente(pedido)}`}
                    className="text-[var(--texto-suave)] hover:text-[var(--primario)]"
                    href={`/pedidos/${pedido.id}`}
                  >
                    <ArrowRight size={16} />
                  </Link>
                </span>
              </Td>
            </tr>
          )
        })}
      </tbody>
    </Tabla>
  )
}
