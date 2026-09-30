'use client'

import { useActionState } from 'react'
import { type EstadoConfig, guardarConfiguracion } from '@/app/(dashboard)/configuracion/actions'
import { Boton, Campo } from '@/components/ui/primitivos'
import type { Configuracion } from '@/types/database'

const INICIAL: EstadoConfig = {}

const DIAS = [
  { valor: 1, nombre: 'Lun' },
  { valor: 2, nombre: 'Mar' },
  { valor: 3, nombre: 'Mié' },
  { valor: 4, nombre: 'Jue' },
  { valor: 5, nombre: 'Vie' },
  { valor: 6, nombre: 'Sáb' },
  { valor: 7, nombre: 'Dom' },
]

export function Aviso({ estado }: { estado: EstadoConfig }) {
  if (estado.error) {
    return (
      <p className="text-[var(--color-destructivo)] text-sm" role="alert">
        {estado.error}
      </p>
    )
  }
  if (estado.ok) {
    return (
      <p className="text-[var(--color-exito)] text-sm" role="status">
        Guardado.
      </p>
    )
  }
  return null
}

/** `para` apunta al id del control: WCAG exige la asociación explícita. */
export function Etiquetado({
  texto,
  para,
  children,
}: {
  texto: string
  para: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="font-medium" htmlFor={para}>
        {texto}
      </label>
      {children}
    </div>
  )
}

export function FormularioConfiguracion({ config }: { config: Configuracion }) {
  const [estado, accion, pendiente] = useActionState(guardarConfiguracion, INICIAL)
  const hhmm = (valor: string) => valor.slice(0, 5)

  return (
    <form action={accion} className="flex flex-col gap-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Etiquetado para="campo-nombre_negocio" texto="Nombre del negocio">
          <Campo
            defaultValue={config.nombre_negocio}
            id="campo-nombre_negocio"
            name="nombre_negocio"
            required
          />
        </Etiquetado>
        <Etiquetado para="campo-saludo_agente" texto="Saludo del agente">
          <Campo
            defaultValue={config.saludo_agente}
            id="campo-saludo_agente"
            name="saludo_agente"
          />
        </Etiquetado>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium text-sm">Días de operación</legend>
        <div className="flex flex-wrap gap-3">
          {DIAS.map((dia) => (
            <label className="flex items-center gap-1 text-sm" key={dia.valor}>
              <input
                defaultChecked={config.dias_operacion.includes(dia.valor)}
                name="dias_operacion"
                type="checkbox"
                value={dia.valor}
              />
              {dia.nombre}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-4">
        <Etiquetado para="campo-hora_apertura" texto="Abre">
          <Campo
            defaultValue={hhmm(config.hora_apertura)}
            id="campo-hora_apertura"
            name="hora_apertura"
            type="time"
          />
        </Etiquetado>
        <Etiquetado para="campo-hora_cierre" texto="Cierra">
          <Campo
            defaultValue={hhmm(config.hora_cierre)}
            id="campo-hora_cierre"
            name="hora_cierre"
            type="time"
          />
        </Etiquetado>
        <Etiquetado para="campo-hora_recoleccion_inicio" texto="Recolección desde">
          <Campo
            defaultValue={hhmm(config.hora_recoleccion_inicio)}
            id="campo-hora_recoleccion_inicio"
            name="hora_recoleccion_inicio"
            type="time"
          />
        </Etiquetado>
        <Etiquetado para="campo-hora_recoleccion_fin" texto="Recolección hasta">
          <Campo
            defaultValue={hhmm(config.hora_recoleccion_fin)}
            id="campo-hora_recoleccion_fin"
            name="hora_recoleccion_fin"
            type="time"
          />
        </Etiquetado>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Etiquetado para="campo-margen_minimo_minutos" texto="Margen mínimo (min)">
          <Campo
            defaultValue={config.margen_minimo_minutos}
            min="0"
            id="campo-margen_minimo_minutos"
            name="margen_minimo_minutos"
            type="number"
          />
        </Etiquetado>
        <Etiquetado
          para="campo-tarifa_recoleccion_entrega"
          texto="Tarifa de recogida y entrega (USD)"
        >
          <Campo
            defaultValue={Number(config.tarifa_recoleccion_entrega).toFixed(2)}
            min="0"
            id="campo-tarifa_recoleccion_entrega"
            name="tarifa_recoleccion_entrega"
            step="0.01"
            type="number"
          />
        </Etiquetado>
        <Etiquetado para="campo-horas_entrega_min" texto="Entrega, mínimo (horas)">
          <Campo
            defaultValue={config.horas_entrega_min}
            min="1"
            id="campo-horas_entrega_min"
            name="horas_entrega_min"
            type="number"
          />
        </Etiquetado>
        <Etiquetado para="campo-horas_entrega_max" texto="Entrega, máximo (horas)">
          <Campo
            defaultValue={config.horas_entrega_max}
            min="1"
            id="campo-horas_entrega_max"
            name="horas_entrega_max"
            type="number"
          />
        </Etiquetado>
        <Etiquetado
          para="campo-limite_mensajes_diarios_por_telefono"
          texto="Máx. mensajes por teléfono/día"
        >
          <Campo
            defaultValue={config.limite_mensajes_diarios_por_telefono}
            min="1"
            id="campo-limite_mensajes_diarios_por_telefono"
            name="limite_mensajes_diarios_por_telefono"
            type="number"
          />
        </Etiquetado>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Etiquetado para="campo-hora_cierre_sabado" texto="Cierra los sábados">
          <Campo
            defaultValue={hhmm(config.hora_cierre_sabado)}
            id="campo-hora_cierre_sabado"
            name="hora_cierre_sabado"
            type="time"
          />
        </Etiquetado>
        <Etiquetado para="campo-radio_cobertura_km" texto="Recogida hasta (km a la redonda)">
          <Campo
            defaultValue={config.radio_cobertura_km}
            min="0.1"
            id="campo-radio_cobertura_km"
            name="radio_cobertura_km"
            step="0.1"
            type="number"
          />
        </Etiquetado>
        <Etiquetado para="campo-telefono_local" texto="Teléfono del local">
          <Campo
            defaultValue={config.telefono_local}
            id="campo-telefono_local"
            name="telefono_local"
          />
        </Etiquetado>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Etiquetado para="campo-direccion_local" texto="Dirección del local">
          <Campo
            defaultValue={config.direccion_local}
            id="campo-direccion_local"
            name="direccion_local"
          />
        </Etiquetado>
        <Etiquetado para="campo-enlace_mapa" texto="Enlace de Google Maps">
          <Campo defaultValue={config.enlace_mapa} id="campo-enlace_mapa" name="enlace_mapa" />
        </Etiquetado>
      </div>

      <div className="flex items-center gap-3">
        <Boton disabled={pendiente} type="submit">
          {pendiente ? 'Guardando…' : 'Guardar configuración'}
        </Boton>
        <Aviso estado={estado} />
      </div>
    </form>
  )
}
