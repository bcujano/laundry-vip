'use client'

import { useActionState } from 'react'
import {
  cambiarProspeccion,
  type EstadoProspeccion,
  guardarLimiteProspeccion,
} from '@/app/(dashboard)/configuracion/prospeccion-actions'
import { Aviso, Boton, BotonAccion, Campo } from '@/components/ui/primitivos'
import type { ResumenProspectos } from '@/server/prospectos/resumen'

const INICIAL: EstadoProspeccion = {}

/**
 * Interruptor de la prospección automática. Arranca apagado y se enciende solo cuando Meta aprobó la
 * plantilla `prospecto_primer_contacto` (pnpm tsx scripts/plantillas-meta.ts --estado).
 */
export function InterruptorProspeccion({
  activa,
  limite,
  resumen,
}: {
  activa: boolean
  limite: number
  resumen: ResumenProspectos
}) {
  const [estado, accion, pendiente] = useActionState(guardarLimiteProspeccion, INICIAL)

  return (
    <div className="flex flex-col gap-3 p-4 text-sm">
      <p>
        Le escribe <strong>una sola vez</strong>, con la plantilla aprobada por Meta, a negocios de
        la lista de{' '}
        <a className="underline" href="/prospectos">
          Prospectos
        </a>{' '}
        que nunca han escrito. Solo a celulares «sin contactar» que no estén fuera de la zona de
        recogida; nunca a clientes, a quien ya le escribió al agente, a quien pidió que no le
        escriban ni a más de {limite} por día. Si responde, lo atiende el agente como a cualquiera.
        Hoy están <strong>{resumen.porEscribir}</strong> por escribir,{' '}
        <strong>{resumen.porLlamar}</strong> fijos por llamar y{' '}
        <strong>{resumen.sinTelefono}</strong> sin teléfono. Está{' '}
        <strong>{activa ? 'ENCENDIDA' : 'APAGADA'}</strong>.
      </p>

      <form action={accion} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1" htmlFor="campo-limite-prospeccion">
          <span className="font-medium">Máximo por día</span>
          <Campo
            className="w-24"
            defaultValue={limite}
            id="campo-limite-prospeccion"
            max="50"
            min="1"
            name="limite"
            type="number"
          />
        </label>
        <Boton disabled={pendiente} type="submit" variante="suave">
          {pendiente ? '…' : 'Guardar'}
        </Boton>
        <Aviso estado={estado} />
      </form>

      <BotonAccion
        confirmacion={
          activa
            ? '¿Apagar la prospección automática?'
            : `¿Encender la prospección automática? Meta debe haber aprobado la plantilla «prospecto_primer_contacto». Cada día a las 10:00 se le escribirá a un máximo de ${limite} negocios que nunca han escrito, y cada mensaje tiene un costo. Si muchos bloquean el número, Meta le baja la calidad al WhatsApp del negocio.`
        }
        onEjecutar={() => cambiarProspeccion(!activa)}
        texto={activa ? 'Apagar prospección automática' : 'Encender prospección automática'}
        variante={activa ? 'peligro' : 'primario'}
      />
    </div>
  )
}
