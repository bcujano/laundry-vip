import Link from 'next/link'
import { Tabla, Td, Th } from '@/components/ui/primitivos'
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
}: {
  pedidos: PedidoConCliente[]
  mostrarHora?: boolean
}) {
  return (
    <Tabla>
      <thead>
        <tr>
          {mostrarHora ? <Th>Hora</Th> : null}
          <Th>Cliente</Th>
          <Th>Estado</Th>
          <Th>Canal</Th>
          <Th>Logística</Th>
          <Th>Lavado</Th>
          <Th> </Th>
        </tr>
      </thead>
      <tbody>
        {pedidos.map((pedido) => {
          const esPresencial = pedido.canal === 'presencial'
          return (
            <tr className={pedido.estado === 'nuevo' ? 'bg-[#EAF3F0]' : ''} key={pedido.id}>
              {mostrarHora ? (
                <Td className="tabular-nums">{soloHora(pedido.ventana_recoleccion_inicio)}</Td>
              ) : null}
              <Td>{nombreCliente(pedido)}</Td>
              <Td>
                <EtiquetaEstado estado={pedido.estado} />
                {pedido.discrepancia_detectada ? (
                  <span className="ml-1 text-[var(--color-destructivo)] text-xs">⚠</span>
                ) : null}
              </Td>
              <Td className="text-[var(--color-texto-apagado)]">{canalLegible(pedido.canal)}</Td>
              <Td className="text-[var(--color-texto-apagado)]">
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
                <Link className="underline" href={`/pedidos/${pedido.id}`}>
                  Ver
                </Link>
              </Td>
            </tr>
          )
        })}
      </tbody>
    </Tabla>
  )
}
