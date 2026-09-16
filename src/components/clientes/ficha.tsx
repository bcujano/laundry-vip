'use client'

import { Save, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import {
  borrarCliente,
  crearCliente,
  type EstadoClientes,
  editarCliente,
} from '@/app/(dashboard)/clientes/actions'
import {
  Aviso,
  Boton,
  BotonAccion,
  CabeceraTarjeta,
  Campo,
  Etiquetado,
  Seleccion,
  Tarjeta,
} from '@/components/ui/primitivos'
import type { CanalOrigen, ModeloFacturacion, TipoNegocio } from '@/types/database'

const INICIAL: EstadoClientes = {}

const TIPOS: { valor: TipoNegocio; texto: string }[] = [
  { valor: 'clinica', texto: 'Clínica' },
  { valor: 'restaurante', texto: 'Restaurante' },
  { valor: 'hotel', texto: 'Hotel' },
  { valor: 'particular', texto: 'Particular' },
  { valor: 'otro', texto: 'Otro' },
]

const CANALES: Record<CanalOrigen, string> = {
  whatsapp_agente: 'Agente de WhatsApp',
  presencial: 'Vino al local',
  referral_ads: 'Anuncio de Meta',
}

type DatosCliente = {
  id: string
  telefono: string
  nombre_negocio: string | null
  nombre_contacto: string | null
  tipo_negocio: TipoNegocio
  modelo_facturacion: ModeloFacturacion
  canal_origen: CanalOrigen
  aviso_privacidad: boolean
}

function CamposCliente({ cliente }: { cliente?: DatosCliente }) {
  const prefijo = cliente ? 'editar' : 'nuevo'

  return (
    <div className="grid gap-3">
      <Etiquetado para={`${prefijo}-negocio`} texto="Nombre del negocio">
        <Campo
          defaultValue={cliente?.nombre_negocio ?? ''}
          id={`${prefijo}-negocio`}
          name="nombre_negocio"
          placeholder="Hotel Quito Plaza"
        />
      </Etiquetado>

      <Etiquetado para={`${prefijo}-contacto`} texto="Persona de contacto">
        <Campo
          defaultValue={cliente?.nombre_contacto ?? ''}
          id={`${prefijo}-contacto`}
          name="nombre_contacto"
          placeholder="Rosa Pérez"
        />
      </Etiquetado>

      <Etiquetado para={`${prefijo}-telefono`} texto="Teléfono">
        <Campo
          defaultValue={cliente?.telefono ?? ''}
          id={`${prefijo}-telefono`}
          name="telefono"
          placeholder="0963987124"
          required
        />
      </Etiquetado>

      <Etiquetado para={`${prefijo}-tipo`} texto="Tipo de negocio">
        <Seleccion
          defaultValue={cliente?.tipo_negocio ?? 'particular'}
          id={`${prefijo}-tipo`}
          name="tipo_negocio"
        >
          {TIPOS.map((tipo) => (
            <option key={tipo.valor} value={tipo.valor}>
              {tipo.texto}
            </option>
          ))}
        </Seleccion>
      </Etiquetado>

      <Etiquetado para={`${prefijo}-facturacion`} texto="Facturación">
        <Seleccion
          defaultValue={cliente?.modelo_facturacion ?? 'por_pedido'}
          id={`${prefijo}-facturacion`}
          name="modelo_facturacion"
        >
          <option value="por_pedido">Por pedido</option>
          <option value="consolidado_mensual">Consolidado mensual</option>
        </Seleccion>
      </Etiquetado>
    </div>
  )
}

export function FichaCliente({
  cliente,
  puedeBorrar,
  tienePedidos,
}: {
  cliente: DatosCliente
  puedeBorrar: boolean
  tienePedidos: boolean
}) {
  const router = useRouter()
  const guardar = editarCliente.bind(null, cliente.id)
  const [estado, accion, pendiente] = useActionState(guardar, INICIAL)

  return (
    <Tarjeta>
      <CabeceraTarjeta titulo="Ficha" />
      <form action={accion} className="flex flex-col gap-4 p-4">
        <CamposCliente cliente={cliente} />

        <dl className="grid gap-1 border-[var(--borde)] border-t pt-3 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--texto-suave)]">Origen</dt>
            <dd>{CANALES[cliente.canal_origen]}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--texto-suave)]">Aviso de privacidad</dt>
            <dd>{cliente.aviso_privacidad ? 'Enviado' : 'Pendiente'}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2">
          <Boton className="justify-center" disabled={pendiente} type="submit">
            <Save size={16} />
            {pendiente ? 'Guardando…' : 'Guardar cambios'}
          </Boton>
          <Aviso estado={estado} />

          {puedeBorrar ? (
            <BotonAccion
              confirmacion={
                tienePedidos
                  ? 'Este cliente tiene pedidos: la base va a rechazar el borrado. ¿Intentarlo igual?'
                  : `¿Borrar a ${cliente.nombre_negocio || cliente.telefono}? No se puede deshacer.`
              }
              icono={<Trash2 size={14} />}
              onEjecutar={async () => {
                const resultado = await borrarCliente(cliente.id)
                if (!resultado.error) router.push('/clientes')
                return resultado
              }}
              texto="Borrar cliente"
              variante="peligro"
            />
          ) : null}
        </div>
      </form>
    </Tarjeta>
  )
}

export function NuevoCliente() {
  const [estado, accion, pendiente] = useActionState(crearCliente, INICIAL)

  return (
    <Tarjeta>
      <CabeceraTarjeta titulo="Nuevo cliente" />
      <form action={accion} className="flex flex-col gap-4 p-4">
        <CamposCliente />
        <div className="flex flex-wrap items-center gap-3">
          <Boton disabled={pendiente} type="submit">
            {pendiente ? 'Creando…' : 'Crear cliente'}
          </Boton>
          <Aviso estado={estado} />
        </div>
      </form>
    </Tarjeta>
  )
}
