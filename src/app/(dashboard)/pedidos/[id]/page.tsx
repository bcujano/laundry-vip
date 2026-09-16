import { notFound } from 'next/navigation'
import { canalLegible, EtiquetaEstado, estadoLegible } from '@/components/pedidos/etiquetas'
import { ChecklistConteo, Cobros, CorreccionCotizacion } from '@/components/pedidos/panel-acciones'
import { Tabla, Tarjeta, Td, Th, TituloSeccion } from '@/components/ui/primitivos'
import { fechaHora, moneda, telefonoLegible } from '@/lib/format'
import { obtener } from '@/server/pedidos/repo'

export const dynamic = 'force-dynamic'

export default async function DetallePedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detalle = await obtener(id)
  if (!detalle) notFound()

  const { pedido, items, eventos, correcciones } = detalle
  const declarados = items.filter((item) => item.origen === 'declarado')
  const verificados = items.filter((item) => item.origen === 'verificado')
  const esPresencial = pedido.canal === 'presencial'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-semibold text-2xl">
          {pedido.cliente?.nombre_negocio ||
            pedido.cliente?.nombre_contacto ||
            telefonoLegible(pedido.cliente?.telefono)}
        </h1>
        <EtiquetaEstado estado={pedido.estado} />
        <span className="text-[var(--color-texto-apagado)] text-sm">
          {canalLegible(pedido.canal)} · creado {fechaHora(pedido.created_at)}
        </span>
      </div>

      <Tarjeta>
        <TituloSeccion>Datos del pedido</TituloSeccion>
        <dl className="grid gap-3 p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[var(--color-texto-apagado)]">Teléfono</dt>
            <dd className="tabular-nums">{telefonoLegible(pedido.cliente?.telefono)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-texto-apagado)]">Tipo de entrega</dt>
            <dd>
              {pedido.tipo_entrega === 'combo'
                ? `Combo (${moneda(pedido.monto_combo)})`
                : pedido.tipo_entrega === 'a_la_carta'
                  ? 'A la carta'
                  : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-texto-apagado)]">Ventana de recolección</dt>
            <dd>{fechaHora(pedido.ventana_recoleccion_inicio)}</dd>
          </div>

          {/* Un pedido presencial no tiene logística: el cliente vino al local. */}
          {esPresencial ? null : (
            <>
              <div>
                <dt className="text-[var(--color-texto-apagado)]">Dirección</dt>
                <dd>{pedido.direccion_recoleccion ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-texto-apagado)]">Vehículo sugerido</dt>
                <dd>
                  {pedido.vehiculo_sugerido ?? '—'}
                  {pedido.numero_fundas ? ` · ${pedido.numero_fundas} funda(s)` : ''}
                </dd>
              </div>
            </>
          )}
        </dl>
      </Tarjeta>

      <Tarjeta>
        <TituloSeccion>Verificación de conteo</TituloSeccion>
        <ChecklistConteo declarados={declarados} pedidoId={pedido.id} verificados={verificados} />
      </Tarjeta>

      <Tarjeta>
        <TituloSeccion>Cobros</TituloSeccion>
        <Cobros pedido={pedido} />
      </Tarjeta>

      <Tarjeta>
        <TituloSeccion>Corrección de cotización</TituloSeccion>
        <CorreccionCotizacion pedido={pedido} />
      </Tarjeta>

      {correcciones.length > 0 ? (
        <Tarjeta>
          <TituloSeccion>Historial de correcciones</TituloSeccion>
          <Tabla>
            <thead>
              <tr>
                <Th>Cuándo</Th>
                <Th>Antes</Th>
                <Th>Después</Th>
                <Th>Motivo</Th>
                <Th>Cliente avisado</Th>
              </tr>
            </thead>
            <tbody>
              {correcciones.map((correccion) => (
                <tr key={correccion.id}>
                  <Td>{fechaHora(correccion.created_at)}</Td>
                  <Td className="tabular-nums">{moneda(correccion.monto_anterior)}</Td>
                  <Td className="tabular-nums">{moneda(correccion.monto_corregido)}</Td>
                  <Td>{correccion.motivo}</Td>
                  <Td>{correccion.notificado_cliente ? 'Sí' : 'Pendiente'}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <TituloSeccion>Línea de tiempo</TituloSeccion>
        <Tabla>
          <thead>
            <tr>
              <Th>Cuándo</Th>
              <Th>Pasó a</Th>
              <Th>Quién</Th>
              <Th>Motivo</Th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((evento) => (
              <tr key={evento.id}>
                <Td>{fechaHora(evento.created_at)}</Td>
                <Td>{estadoLegible(evento.estado_nuevo as never)}</Td>
                <Td className="text-[var(--color-texto-apagado)]">{evento.actor}</Td>
                <Td className="text-[var(--color-texto-apagado)]">{evento.motivo ?? '—'}</Td>
              </tr>
            ))}
            {eventos.length === 0 ? (
              <tr>
                <Td className="text-[var(--color-texto-apagado)]">Sin eventos todavía.</Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
              </tr>
            ) : null}
          </tbody>
        </Tabla>
      </Tarjeta>
    </div>
  )
}
