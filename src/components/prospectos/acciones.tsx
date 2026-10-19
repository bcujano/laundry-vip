'use client'

import { useActionState } from 'react'
import {
  type EstadoProspectoAccion,
  guardarNotasProspecto,
  marcarProspecto,
} from '@/app/(dashboard)/prospectos/actions'
import { Boton, BotonAccion, Campo } from '@/components/ui/primitivos'
import type { Etapa } from '@/server/prospectos/etapa'

const INICIAL: EstadoProspectoAccion = {}

/** Los botones de cada fila, según en qué etapa va: no se ofrece lo que no tiene sentido. */
export function AccionesProspecto({
  id,
  etapa,
  nombre,
}: {
  id: string
  etapa: Etapa
  nombre: string
}) {
  if (etapa === 'cliente') return <span className="text-[var(--texto-suave)] text-xs">—</span>

  return (
    <div className="flex flex-wrap gap-1">
      {etapa === 'nuevo' ? (
        <BotonAccion onEjecutar={() => marcarProspecto(id, 'contactado')} texto="Ya lo contacté" />
      ) : null}
      {etapa === 'descartado' ? (
        <BotonAccion onEjecutar={() => marcarProspecto(id, 'nuevo')} texto="Reabrir" />
      ) : null}
      {etapa === 'nuevo' || etapa === 'contactado' || etapa === 'respondio' ? (
        <BotonAccion
          confirmacion={`¿Descartar a «${nombre}»? Deja de aparecer como pendiente y no se le escribirá.`}
          onEjecutar={() => marcarProspecto(id, 'descartado')}
          texto="Descartar"
        />
      ) : null}
      {etapa !== 'no_contactar' ? (
        <BotonAccion
          confirmacion={`¿Marcar a «${nombre}» como «no contactar»? Es definitivo: pidió que no se le escriba.`}
          onEjecutar={() => marcarProspecto(id, 'no_contactar')}
          texto="No contactar"
          variante="peligro"
        />
      ) : null}
    </div>
  )
}

/** Las notas de la llamada o de lo que habló: una línea editable por prospecto. */
export function NotasProspecto({ id, notas }: { id: string; notas: string }) {
  const [estado, accion, pendiente] = useActionState(guardarNotasProspecto, INICIAL)
  return (
    <form action={accion} className="flex items-center gap-1">
      <input name="id" type="hidden" value={id} />
      <Campo
        aria-label="Notas del prospecto"
        className="w-48"
        defaultValue={notas}
        maxLength={1000}
        name="notas"
        placeholder="Notas de la llamada…"
        type="text"
      />
      <Boton disabled={pendiente} type="submit" variante="suave">
        {pendiente ? '…' : 'Guardar'}
      </Boton>
      {estado.error ? (
        <span className="text-[var(--peligro)] text-xs" role="alert">
          {estado.error}
        </span>
      ) : estado.ok ? (
        <span className="text-[var(--exito)] text-xs" role="status">
          Guardado
        </span>
      ) : null}
    </form>
  )
}
