'use client'

import { Plus } from 'lucide-react'
import { useActionState, useEffect, useRef, useState } from 'react'
import { crearServicio, type EstadoServicio } from '@/app/(dashboard)/servicios/actions'
import { Boton, Campo, Tarjeta, TituloSeccion } from '@/components/ui/primitivos'
import { metodoLegible, unidadLegible } from '@/lib/format'

const METODOS = ['unico', 'agua', 'seco', 'planchado'] as const
const UNIDADES = ['pieza', 'kilo', 'libra', 'm2', 'par', 'paquete'] as const

/**
 * Alta de un ítem del catálogo. Desde que se guarda, el agente de WhatsApp ya
 * lo cotiza: lee el catálogo en cada consulta, no hay nada que actualizar en n8n.
 */
export function NuevoServicio({ categorias }: { categorias: string[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoServicio, FormData>(crearServicio, {})
  const [unidad, setUnidad] = useState<string>('pieza')
  const formulario = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (estado.ok) {
      formulario.current?.reset()
      setUnidad('pieza')
    }
  }, [estado])

  return (
    <Tarjeta>
      <TituloSeccion>Agregar servicio</TituloSeccion>
      <form
        action={accion}
        className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
        ref={formulario}
      >
        <label className="flex flex-col gap-1 text-sm" htmlFor="nuevo-categoria">
          <span className="font-medium">Categoría</span>
          <Campo
            id="nuevo-categoria"
            list="categorias-existentes"
            name="categoria"
            placeholder="Hogar y otros"
            required
          />
          <datalist id="categorias-existentes">
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1 text-sm lg:col-span-2" htmlFor="nuevo-nombre">
          <span className="font-medium">Nombre del ítem</span>
          <Campo id="nuevo-nombre" name="nombre_item" placeholder="Toalla de baño" required />
        </label>

        <label className="flex flex-col gap-1 text-sm" htmlFor="nuevo-metodo">
          <span className="font-medium">Método</span>
          <select className="campo" defaultValue="unico" id="nuevo-metodo" name="metodo">
            {METODOS.map((metodo) => (
              <option key={metodo} value={metodo}>
                {metodoLegible(metodo)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm" htmlFor="nuevo-unidad">
          <span className="font-medium">Unidad</span>
          <select
            className="campo"
            id="nuevo-unidad"
            name="unidad"
            onChange={(evento) => setUnidad(evento.target.value)}
            value={unidad}
          >
            {UNIDADES.map((valor) => (
              <option key={valor} value={valor}>
                {unidadLegible(valor)}
              </option>
            ))}
          </select>
        </label>

        {unidad === 'paquete' ? (
          <label className="flex flex-col gap-1 text-sm" htmlFor="nuevo-paquete">
            <span className="font-medium">Prendas por paquete</span>
            <Campo id="nuevo-paquete" min="1" name="cantidad_por_paquete" required type="number" />
          </label>
        ) : null}

        <label className="flex flex-col gap-1 text-sm" htmlFor="nuevo-precio-min">
          <span className="font-medium">Precio (USD)</span>
          <Campo
            id="nuevo-precio-min"
            min="0"
            name="precio_min"
            placeholder="3.50"
            required
            step="0.01"
            type="number"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm" htmlFor="nuevo-precio-max">
          <span className="font-medium">Precio máximo (solo si es rango)</span>
          <Campo
            id="nuevo-precio-max"
            min="0"
            name="precio_max"
            placeholder="vacío = precio fijo"
            step="0.01"
            type="number"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
          <Boton disabled={pendiente} type="submit">
            <Plus size={16} /> {pendiente ? 'Guardando…' : 'Agregar al catálogo'}
          </Boton>
          {estado.error ? (
            <span className="text-[var(--peligro)] text-sm" role="alert">
              {estado.error}
            </span>
          ) : estado.ok ? (
            <span className="text-[var(--exito)] text-sm" role="status">
              Agregado. El agente ya lo cotiza.
            </span>
          ) : null}
          <span className="text-[var(--texto-suave)] text-xs">
            Si eliges agua, seco o planchado, el agente preguntará el método antes de dar precio.
          </span>
        </div>
      </form>
    </Tarjeta>
  )
}
