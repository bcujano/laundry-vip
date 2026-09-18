'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  agregarOperadorWhitelist,
  alternarOperador,
  cambiarNivelOperadorAccion,
  type EstadoConfig,
  eliminarOperadorWhitelist,
} from '@/app/(dashboard)/configuracion/actions'
import { Boton, Campo, Tabla, Td, Th } from '@/components/ui/primitivos'
import { telefonoLegible } from '@/lib/format'
import type { NivelOperador, OperadorWhitelist } from '@/types/database'
import { Aviso, Etiquetado } from './formularios'

/**
 * Los WhatsApp autorizados y su nivel. El permiso real lo aplica el servidor
 * en cada acción del agente; aquí solo se decide quién tiene qué.
 */

const NIVELES: { valor: NivelOperador; texto: string; ayuda: string }[] = [
  {
    valor: 'operador',
    texto: 'Operador de planta',
    ayuda: 'Registra órdenes, cuenta prendas y avanza estados.',
  },
  {
    valor: 'admin',
    texto: 'Administrador',
    ayuda: 'Además pide reportes, resúmenes y recibe el resumen de las 8:00.',
  },
]

function AccionesOperador({ operador }: { operador: OperadorWhitelist }) {
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | undefined>()

  function ejecutar(accion: () => Promise<EstadoConfig>) {
    iniciar(async () => setError((await accion()).error))
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm">
      <button
        className="text-[var(--primario)] hover:underline disabled:opacity-50"
        disabled={pendiente}
        onClick={() => ejecutar(() => alternarOperador(operador.id, !operador.activo))}
        type="button"
      >
        {operador.activo ? 'Pausar' : 'Activar'}
      </button>
      <button
        className="text-[var(--peligro)] hover:underline disabled:opacity-50"
        disabled={pendiente}
        onClick={() => {
          if (
            confirm(
              `¿Quitar a ${operador.nombre} de los autorizados? Desde ya el agente lo tratará como cliente.`,
            )
          ) {
            ejecutar(() => eliminarOperadorWhitelist(operador.id))
          }
        }}
        type="button"
      >
        Quitar
      </button>
      {error ? <span className="text-[var(--peligro)] text-xs">{error}</span> : null}
    </div>
  )
}

function SelectorNivel({ operador }: { operador: OperadorWhitelist }) {
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | undefined>()

  return (
    <div className="flex flex-col gap-0.5">
      <select
        aria-label={`Nivel de ${operador.nombre}`}
        className="campo w-44 py-1 text-sm"
        defaultValue={operador.nivel}
        disabled={pendiente}
        onChange={(evento) => {
          const nivel = evento.target.value as NivelOperador
          iniciar(async () =>
            setError((await cambiarNivelOperadorAccion(operador.id, nivel)).error),
          )
        }}
      >
        {NIVELES.map((nivel) => (
          <option key={nivel.valor} value={nivel.valor}>
            {nivel.texto}
          </option>
        ))}
      </select>
      {error ? <span className="text-[var(--peligro)] text-xs">{error}</span> : null}
    </div>
  )
}

export function ListaBlanca({ operadores }: { operadores: OperadorWhitelist[] }) {
  const [estado, accion, pendiente] = useActionState(agregarOperadorWhitelist, {})

  return (
    <div className="flex flex-col gap-3 p-4">
      <ul className="grid gap-1 text-[var(--texto-suave)] text-xs sm:grid-cols-2">
        {NIVELES.map((nivel) => (
          <li key={nivel.valor}>
            <strong className="text-[var(--texto)]">{nivel.texto}:</strong> {nivel.ayuda}
          </li>
        ))}
        <li className="sm:col-span-2">
          Nadie mueve dinero por WhatsApp: pagos, montos y discrepancias se resuelven aquí en el
          CRM.
        </li>
      </ul>

      <Tabla>
        <thead>
          <tr>
            <Th>Nombre</Th>
            <Th>Teléfono</Th>
            <Th>Nivel</Th>
            <Th>Estado</Th>
            <Th> </Th>
          </tr>
        </thead>
        <tbody>
          {operadores.map((operador) => (
            <tr key={operador.id}>
              <Td>{operador.nombre}</Td>
              <Td className="tabular-nums">{telefonoLegible(operador.telefono)}</Td>
              <Td>
                <SelectorNivel operador={operador} />
              </Td>
              <Td>{operador.activo ? 'Activo' : 'Pausado'}</Td>
              <Td>
                <AccionesOperador operador={operador} />
              </Td>
            </tr>
          ))}
          {operadores.length === 0 ? (
            <tr>
              <Td className="text-[var(--color-texto-apagado)]">
                Ningún número autorizado todavía.
              </Td>
              <Td> </Td>
              <Td> </Td>
              <Td> </Td>
              <Td> </Td>
            </tr>
          ) : null}
        </tbody>
      </Tabla>

      <form action={accion} className="flex flex-wrap items-end gap-2">
        <Etiquetado para="campo-nombre" texto="Nombre">
          <Campo id="campo-nombre" name="nombre" placeholder="Operador de planta" required />
        </Etiquetado>
        <Etiquetado para="campo-telefono" texto="Teléfono">
          <Campo id="campo-telefono" name="telefono" placeholder="0963987124" required />
        </Etiquetado>
        <Etiquetado para="campo-nivel" texto="Nivel">
          <select className="campo w-44" defaultValue="operador" id="campo-nivel" name="nivel">
            {NIVELES.map((nivel) => (
              <option key={nivel.valor} value={nivel.valor}>
                {nivel.texto}
              </option>
            ))}
          </select>
        </Etiquetado>
        <Boton disabled={pendiente} type="submit" variante="suave">
          {pendiente ? 'Agregando…' : 'Agregar'}
        </Boton>
        <Aviso estado={estado} />
      </form>
    </div>
  )
}
