'use client'

import { useActionState } from 'react'
import { type EstadoServicio, guardarPrecio } from '@/app/(dashboard)/servicios/actions'
import { Boton, Campo, Td } from '@/components/ui/primitivos'
import { metodoLegible, moneda, rangoPrecio, unidadLegible } from '@/lib/format'
import type { Servicio } from '@/types/database'

const INICIAL: EstadoServicio = {}

export function FilaPrecio({ servicio, editable }: { servicio: Servicio; editable: boolean }) {
  const [estado, accion, pendiente] = useActionState(guardarPrecio, INICIAL)
  const esRango = Number(servicio.precio_min) !== Number(servicio.precio_max)

  return (
    <tr className={servicio.activo ? '' : 'opacity-50'}>
      <Td>{servicio.nombre_item}</Td>
      <Td className="text-[var(--color-texto-apagado)]">{metodoLegible(servicio.metodo)}</Td>
      <Td className="text-[var(--color-texto-apagado)]">{unidadLegible(servicio.unidad)}</Td>

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
            <Boton disabled={pendiente} type="submit" variante="secundario">
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
    </tr>
  )
}
