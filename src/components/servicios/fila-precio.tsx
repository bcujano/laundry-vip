'use client'

import { Trash2 } from 'lucide-react'

import { useActionState } from 'react'
import {
  borrarServicio,
  type EstadoServicio,
  guardarPrecio,
} from '@/app/(dashboard)/servicios/actions'
import { Boton, BotonAccion, Campo, Td } from '@/components/ui/primitivos'
import { metodoLegible, moneda, rangoPrecio, unidadLegible } from '@/lib/format'
import type { Servicio } from '@/types/database'

const INICIAL: EstadoServicio = {}

export function FilaPrecio({
  servicio,
  editable,
  puedeBorrar = false,
}: {
  servicio: Servicio
  editable: boolean
  puedeBorrar?: boolean
}) {
  const [estado, accion, pendiente] = useActionState(guardarPrecio, INICIAL)
  const esRango = Number(servicio.precio_min) !== Number(servicio.precio_max)
  // Promoción por cantidad: «3 x $12,00» junto al precio de la unidad suelta.
  const promocion = servicio.precio_paquete === null ? null : Number(servicio.precio_paquete)

  return (
    <tr className={servicio.activo ? '' : 'opacity-50'}>
      <Td>{servicio.nombre_item}</Td>
      <Td className="text-[var(--color-texto-apagado)]">{metodoLegible(servicio.metodo)}</Td>
      <Td className="text-[var(--color-texto-apagado)]">
        {unidadLegible(servicio.unidad)}
        {promocion ? (
          <span className="block text-xs">
            {servicio.cantidad_por_paquete} x {moneda(promocion)}
          </span>
        ) : null}
      </Td>

      {editable ? (
        <Td>
          <form action={accion} className="flex items-center gap-1">
            <input name="id" type="hidden" value={servicio.id} />
            <Campo
              aria-label={`Precio mínimo de ${servicio.nombre_item}`}
              className="w-20"
              defaultValue={Number(servicio.precio_min).toFixed(2)}
              min="0"
              name="precio_min"
              step="0.01"
              type="number"
            />
            <Campo
              aria-label={`Precio máximo de ${servicio.nombre_item}`}
              className="w-20"
              defaultValue={Number(servicio.precio_max).toFixed(2)}
              min="0"
              name="precio_max"
              step="0.01"
              type="number"
            />
            {servicio.cantidad_por_paquete && servicio.cantidad_por_paquete > 1 ? (
              <Campo
                aria-label={`Precio del paquete de ${servicio.cantidad_por_paquete} de ${servicio.nombre_item}`}
                className="w-20"
                defaultValue={promocion === null ? '' : promocion.toFixed(2)}
                min="0"
                name="precio_paquete"
                placeholder={`x${servicio.cantidad_por_paquete}`}
                step="0.01"
                type="number"
              />
            ) : null}
            <Boton disabled={pendiente} type="submit" variante="suave">
              {pendiente ? '…' : 'Guardar'}
            </Boton>
            {estado.error ? (
              <span className="text-[var(--color-destructivo)] text-xs" role="alert">
                {estado.error}
              </span>
            ) : null}
            {estado.ok ? (
              <span className="text-[var(--color-exito)] text-xs" role="status">
                Guardado
              </span>
            ) : null}
          </form>
        </Td>
      ) : (
        <Td className="tabular-nums">
          {esRango
            ? rangoPrecio(servicio.precio_min, servicio.precio_max)
            : moneda(servicio.precio_min)}
        </Td>
      )}

      {puedeBorrar ? (
        <Td>
          <BotonAccion
            confirmacion={`¿Borrar "${servicio.nombre_item}" del catálogo? Los pedidos viejos conservan su descripción.`}
            icono={<Trash2 size={14} />}
            onEjecutar={() => borrarServicio(servicio.id)}
            texto=""
            variante="peligro"
          />
        </Td>
      ) : null}
    </tr>
  )
}
