'use client'

import { Plus } from 'lucide-react'
import { useActionState, useState } from 'react'
import { crearPedidoManual, type EstadoPedidos } from '@/app/(dashboard)/pedidos/actions'
import {
  Aviso,
  Boton,
  CabeceraTarjeta,
  Campo,
  Etiquetado,
  Seleccion,
  Tarjeta,
} from '@/components/ui/primitivos'

const INICIAL: EstadoPedidos = {}

export type OpcionCliente = { id: string; nombre: string }

/**
 * Alta manual de un pedido, para lo que entra por el mostrador o por teléfono.
 * Los precios NO se escriben aquí: se calculan contra el catálogo, igual que
 * cuando cotiza el agente.
 */
export function NuevoPedido({ clientes }: { clientes: OpcionCliente[] }) {
  const [estado, accion, pendiente] = useActionState(crearPedidoManual, INICIAL)
  const [canal, setCanal] = useState<'whatsapp_agente' | 'presencial'>('presencial')
  const esPresencial = canal === 'presencial'

  if (clientes.length === 0) {
    return (
      <Tarjeta>
        <CabeceraTarjeta titulo="Nuevo pedido" />
        <p className="p-4 text-[var(--texto-suave)] text-sm">
          Primero crea un cliente: un pedido siempre es de alguien.
        </p>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta>
      <CabeceraTarjeta titulo="Nuevo pedido" />
      <form action={accion} className="flex flex-col gap-3 p-4">
        <Etiquetado para="pedido-cliente" texto="Cliente">
          <Seleccion id="pedido-cliente" name="cliente_id" required>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </Seleccion>
        </Etiquetado>

        <Etiquetado para="pedido-canal" texto="Canal">
          <Seleccion
            id="pedido-canal"
            name="canal"
            onChange={(evento) => setCanal(evento.target.value as typeof canal)}
            value={canal}
          >
            <option value="presencial">Presencial (vino al local)</option>
            <option value="whatsapp_agente">Con recolección a domicilio</option>
          </Seleccion>
        </Etiquetado>

        <Etiquetado para="pedido-prendas" texto="Prendas">
          <textarea
            className="campo min-h-24"
            id="pedido-prendas"
            name="prendas"
            placeholder={'5 camisetas\n2 pantalones de terno\n1 edredón 2 plazas'}
            required
          />
        </Etiquetado>
        <p className="-mt-1 text-[var(--texto-suave)] text-xs">
          Una prenda por línea, con la cantidad delante. Los precios salen del catálogo.
        </p>

        {esPresencial ? null : (
          <>
            <Etiquetado para="pedido-entrega" texto="Tipo de entrega">
              <Seleccion defaultValue="combo" id="pedido-entrega" name="tipo_entrega">
                <option value="combo">Recogida y entrega (tarifa única)</option>
                <option value="a_la_carta">El cliente trae y retira</option>
              </Seleccion>
            </Etiquetado>

            <div className="grid gap-3 sm:grid-cols-2">
              <Etiquetado para="pedido-fundas" texto="Número de fundas">
                <Campo
                  defaultValue={1}
                  id="pedido-fundas"
                  min="1"
                  name="numero_fundas"
                  type="number"
                />
              </Etiquetado>
              <Etiquetado para="pedido-direccion" texto="Dirección">
                <Campo
                  id="pedido-direccion"
                  name="direccion_recoleccion"
                  placeholder="Av. Mariscal Sucre 123"
                />
              </Etiquetado>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Boton disabled={pendiente} type="submit">
            <Plus size={16} />
            {pendiente ? 'Creando…' : 'Crear pedido'}
          </Boton>
          <Aviso estado={estado} />
        </div>
      </form>
    </Tarjeta>
  )
}
