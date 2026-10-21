'use client'

import { useActionState } from 'react'
import {
  type EstadoProspectoAccion,
  registrarContactoManual,
} from '@/app/(dashboard)/prospectos/actions'
import { Boton, Campo, Seleccion } from '@/components/ui/primitivos'

const INICIAL: EstadoProspectoAccion = {}

/** El equipo anota un contacto que hizo por su cuenta: llamada, mensaje, Instagram… */
export function RegistroContacto({ id, primero }: { id: string; primero: boolean }) {
  const [estado, accion, pendiente] = useActionState(registrarContactoManual, INICIAL)
  return (
    <details className="text-sm">
      <summary className="cursor-pointer underline">Registrar contacto</summary>
      <form action={accion} className="mt-2 flex flex-col gap-1">
        <input name="id" type="hidden" value={id} />
        <Seleccion
          aria-label="Tipo de contacto"
          defaultValue={primero ? 'primer_contacto' : 'seguimiento'}
          name="tipo"
        >
          <option value="primer_contacto">Primer contacto</option>
          <option value="seguimiento">Seguimiento</option>
          <option value="respuesta">Me respondió</option>
        </Seleccion>
        <Seleccion aria-label="Canal" defaultValue="llamada" name="canal">
          <option value="llamada">Llamada</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="email">Correo</option>
          <option value="otro">Otro</option>
        </Seleccion>
        <Campo
          aria-label="Qué pasó"
          maxLength={200}
          name="resultado"
          placeholder="Qué pasó (ej.: pidió cotización)"
          required
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
            Registrado
          </span>
        ) : null}
      </form>
    </details>
  )
}
