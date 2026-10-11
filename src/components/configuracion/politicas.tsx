'use client'

import { useActionState } from 'react'
import {
  type EstadoPolitica,
  guardarPoliticaAccion,
} from '@/app/(dashboard)/configuracion/politicas-actions'
import { Aviso, Boton, Campo, Etiquetado, Seleccion } from '@/components/ui/primitivos'
import type { Politica } from '@/types/database'

const INICIAL: EstadoPolitica = {}

function FilaPolitica({ politica }: { politica: Politica }) {
  const [estado, accion, pendiente] = useActionState(
    guardarPoliticaAccion.bind(null, politica.id),
    INICIAL,
  )
  const id = (campo: string) => `politica-${politica.tema}-${campo}`

  return (
    <form action={accion} className="flex flex-col gap-3 border-[var(--borde)] border-b p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{politica.titulo}</h3>
        <label className="flex items-center gap-2 text-sm">
          <input defaultChecked={politica.activa} name="activa" type="checkbox" />
          Activa
        </label>
      </div>

      <Etiquetado
        para={id('regla')}
        texto="Regla (lo que el agente puede decir; vacía = lo decide una persona)"
      >
        <textarea
          className="campo min-h-20"
          defaultValue={politica.regla}
          id={id('regla')}
          name="regla"
          rows={3}
        />
      </Etiquetado>

      <div className="grid gap-3 sm:grid-cols-3">
        <Etiquetado para={id('quien')} texto="Quién decide">
          <Seleccion defaultValue={politica.quien_decide} id={id('quien')} name="quien_decide">
            <option value="agente">El agente, con la regla</option>
            <option value="equipo">El equipo</option>
            <option value="duena">La dueña</option>
          </Seleccion>
        </Etiquetado>
        <Etiquetado para={id('plazo')} texto="Plazo de respuesta (texto)">
          <Campo
            defaultValue={politica.plazo_respuesta}
            id={id('plazo')}
            name="plazo_respuesta"
            placeholder="en unos 30 minutos"
          />
        </Etiquetado>
        <Etiquetado para={id('frase')} texto="Frase guía (el agente la dice con sus palabras)">
          <Campo defaultValue={politica.frase_guia} id={id('frase')} name="frase_guia" />
        </Etiquetado>
      </div>

      <div className="flex items-center gap-3">
        <Boton disabled={pendiente} type="submit" variante="primario">
          {pendiente ? 'Guardando…' : 'Guardar'}
        </Boton>
        <Aviso estado={estado.ok ? { aviso: 'Guardado.' } : { error: estado.error }} />
      </div>
    </form>
  )
}

export function ListaPoliticas({ politicas }: { politicas: Politica[] }) {
  return (
    <div className="flex flex-col">
      <p className="p-4 text-[var(--texto-suave)] text-sm">
        Lo que el agente responde cuando el cliente pregunta por estos temas. Si una regla está
        vacía o la decide una persona, el agente no inventa nada: lo confirma con el equipo.
      </p>
      {politicas.map((politica) => (
        <FilaPolitica key={politica.id} politica={politica} />
      ))}
    </div>
  )
}
