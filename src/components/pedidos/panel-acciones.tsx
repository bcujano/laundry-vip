'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  confirmarPagoAccion,
  corregirCotizacionAccion,
  type EstadoAccion,
  resolverDiscrepanciaAccion,
  verificarConteoAccion,
} from '@/app/(dashboard)/pedidos/[id]/actions'
import { Boton, Campo, Tabla, Td, Th } from '@/components/ui/primitivos'
import { moneda } from '@/lib/format'
import type { Pedido, PedidoItem } from '@/types/database'

const INICIAL: EstadoAccion = {}

function Aviso({ estado }: { estado: EstadoAccion }) {
  if (estado.error) {
    return (
      <p className="text-[var(--color-destructivo)] text-sm" role="alert">
        {estado.error}
      </p>
    )
  }
  if (estado.aviso) {
    return (
      <p className="text-[var(--color-exito)] text-sm" role="status">
        {estado.aviso}
      </p>
    )
  }
  return null
}

/**
 * El operador cuenta las prendas contra lo declarado. Si algo no cuadra, el
 * pedido se congela: nunca se cobra en silencio un monto distinto.
 */
export function ChecklistConteo({
  pedidoId,
  declarados,
  verificados,
}: {
  pedidoId: string
  declarados: PedidoItem[]
  verificados: PedidoItem[]
}) {
  const accionConPedido = verificarConteoAccion.bind(null, pedidoId)
  const [estado, accion, pendiente] = useActionState(accionConPedido, INICIAL)
  const yaVerificado = new Map(verificados.map((v) => [v.item_declarado_id, Number(v.cantidad)]))

  if (declarados.length === 0) {
    return (
      <p className="px-4 py-6 text-[var(--color-texto-apagado)] text-sm">
        Este pedido no tiene prendas declaradas que verificar.
      </p>
    )
  }

  return (
    <form action={accion} className="flex flex-col gap-3 p-4">
      <Tabla>
        <thead>
          <tr>
            <Th>Prenda</Th>
            <Th>Declaradas</Th>
            <Th>Contadas en planta</Th>
            <Th>Precio unit.</Th>
          </tr>
        </thead>
        <tbody>
          {declarados.map((item) => (
            <tr key={item.id}>
              <Td>{item.descripcion}</Td>
              <Td className="tabular-nums">{Number(item.cantidad)}</Td>
              <Td>
                <Campo
                  aria-label={`Cantidad contada de ${item.descripcion}`}
                  className="w-24"
                  defaultValue={yaVerificado.get(item.id) ?? Number(item.cantidad)}
                  min="0"
                  name={`conteo:${item.id}`}
                  step="0.01"
                  type="number"
                />
              </Td>
              <Td className="tabular-nums">{moneda(item.precio_unitario)}</Td>
            </tr>
          ))}
        </tbody>
      </Tabla>

      <div className="flex flex-wrap items-center gap-3">
        <Boton disabled={pendiente} type="submit">
          {pendiente ? 'Verificando…' : 'Verificar conteo'}
        </Boton>
        <span className="text-[var(--color-texto-apagado)] text-xs">
          Se verifica antes de lavar. Si no cuadra, el pedido se congela.
        </span>
        <Aviso estado={estado} />
      </div>
    </form>
  )
}

function BotonAccion({
  texto,
  onEjecutar,
  variante = 'secundario',
}: {
  texto: string
  onEjecutar: () => Promise<EstadoAccion>
  variante?: 'primario' | 'secundario' | 'destructivo'
}) {
  const [estado, setEstado] = useState<EstadoAccion>(INICIAL)
  const [pendiente, iniciar] = useTransition()

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Boton
        disabled={pendiente}
        onClick={() => iniciar(async () => setEstado(await onEjecutar()))}
        variante={variante}
      >
        {pendiente ? '…' : texto}
      </Boton>
      <Aviso estado={estado} />
    </span>
  )
}

/** Nunca se despacha un tramo "app" sin su pago confirmado. */
export function Cobros({ pedido }: { pedido: Pedido }) {
  const tramos = [
    {
      clave: 'recoleccion' as const,
      texto: 'Recolección',
      metodo: pedido.metodo_transporte_recoleccion,
      pago: pedido.pago_recoleccion,
      monto: pedido.monto_recoleccion,
    },
    {
      clave: 'entrega' as const,
      texto: 'Entrega',
      metodo: pedido.metodo_transporte_entrega,
      pago: pedido.pago_entrega,
      monto: pedido.monto_entrega,
    },
  ]

  return (
    <div className="flex flex-col gap-3 p-4">
      {tramos.map((tramo) => (
        <div className="flex flex-wrap items-center gap-3 text-sm" key={tramo.clave}>
          <span className="w-28 font-medium">{tramo.texto}</span>
          <span className="text-[var(--color-texto-apagado)]">
            {tramo.metodo === 'n_a'
              ? 'sin gestionar'
              : tramo.metodo === 'propio_cliente'
                ? 'transporte del cliente · la lavandería no paga'
                : `vía app · ${moneda(tramo.monto)}`}
          </span>
          {tramo.metodo === 'app' && tramo.pago !== 'pagado' ? (
            <BotonAccion
              onEjecutar={() => confirmarPagoAccion(pedido.id, tramo.clave)}
              texto="Confirmar pago"
            />
          ) : (
            <span className="text-[var(--color-texto-apagado)]">
              {tramo.pago === 'pagado' ? 'pagado' : '—'}
            </span>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-[var(--color-borde)] border-t pt-3 text-sm">
        <span className="w-28 font-medium">Lavado</span>
        <span className="text-[var(--color-texto-apagado)]">
          {pedido.monto_confirmado_lavado !== null
            ? `${moneda(pedido.monto_confirmado_lavado)} confirmado`
            : `${moneda(pedido.monto_estimado_lavado)} estimado`}
          {' · '}
          {pedido.pago_lavado}
        </span>
        {pedido.pago_lavado !== 'pagado' && pedido.pago_lavado !== 'acumulado_mensual' ? (
          <BotonAccion
            onEjecutar={() => confirmarPagoAccion(pedido.id, 'lavado')}
            texto="Marcar lavado como pagado"
          />
        ) : null}
      </div>
    </div>
  )
}

export function CorreccionCotizacion({ pedido }: { pedido: Pedido }) {
  const accionConPedido = corregirCotizacionAccion.bind(null, pedido.id)
  const [estado, accion, pendiente] = useActionState(accionConPedido, INICIAL)
  const vigente = pedido.monto_confirmado_lavado ?? pedido.monto_estimado_lavado

  return (
    <div className="flex flex-col gap-3 p-4">
      {pedido.discrepancia_detectada ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-[#FBE9E7] p-3 text-sm">
          <p>
            <strong>Pedido congelado por discrepancia.</strong> {pedido.discrepancia_motivo}
          </p>
          <p className="text-[var(--color-texto-apagado)] text-xs">
            Hay que avisarle al cliente el monto final y el motivo antes de pedirle el pago.
          </p>
          <BotonAccion
            onEjecutar={() => resolverDiscrepanciaAccion(pedido.id)}
            texto="El cliente aceptó: cerrar discrepancia"
          />
        </div>
      ) : null}

      <form action={accion} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1 text-sm">
          <label className="font-medium" htmlFor="monto-corregido">
            Monto corregido (vigente: {moneda(vigente)})
          </label>
          <Campo
            className="w-28"
            defaultValue={vigente !== null ? Number(vigente).toFixed(2) : ''}
            id="monto-corregido"
            min="0"
            name="monto"
            step="0.01"
            type="number"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1 text-sm">
          <label className="font-medium" htmlFor="motivo-correccion">
            Motivo
          </label>
          <Campo
            id="motivo-correccion"
            name="motivo"
            placeholder="Vinieron 2 chompas que no estaban en la lista"
            required
          />
        </div>
        <Boton disabled={pendiente} type="submit" variante="destructivo">
          {pendiente ? 'Corrigiendo…' : 'Corregir cotización'}
        </Boton>
      </form>
      <Aviso estado={estado} />
    </div>
  )
}
