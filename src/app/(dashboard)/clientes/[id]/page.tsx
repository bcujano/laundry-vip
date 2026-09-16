import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FichaCliente } from '@/components/clientes/ficha'
import { EtiquetaEstado } from '@/components/pedidos/etiquetas'
import { CabeceraTarjeta, Tabla, Tarjeta, Td, Th, Vacio } from '@/components/ui/primitivos'
import { verifyAuth } from '@/lib/auth'
import { fechaHora, moneda, soloFecha, telefonoLegible, tipoNegocioLegible } from '@/lib/format'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener } from '@/server/clientes/repo'
import type { Pedido } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function DetalleCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [cliente, sesion] = await Promise.all([obtener(id), verifyAuth()])
  if (!cliente) notFound()

  const { data } = await supabaseAdmin()
    .from('pedidos')
    .select('*')
    .eq('cliente_id', id)
    .order('created_at', { ascending: false })

  const pedidos = (data ?? []) as Pedido[]
  const facturado = pedidos
    .filter((pedido) => pedido.estado !== 'cancelado' && pedido.monto_confirmado_lavado !== null)
    .reduce((suma, pedido) => suma + Number(pedido.monto_confirmado_lavado), 0)

  return (
    <div className="flex flex-col gap-4">
      <Link
        className="flex w-fit items-center gap-1.5 text-[var(--texto-suave)] text-sm hover:text-[var(--texto)]"
        href="/clientes"
      >
        <ArrowLeft size={14} /> Clientes
      </Link>

      <div>
        <h1 className="font-bold text-2xl tracking-tight">
          {cliente.nombre_negocio || cliente.nombre_contacto || telefonoLegible(cliente.telefono)}
        </h1>
        <p className="text-[var(--texto-suave)] text-sm">
          {tipoNegocioLegible(cliente.tipo_negocio)} · cliente desde {soloFecha(cliente.created_at)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tarjeta className="p-4">
          <p className="text-[var(--texto-suave)] text-xs">Pedidos</p>
          <p className="mt-1 font-bold text-2xl tabular-nums">{pedidos.length}</p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-[var(--texto-suave)] text-xs">Facturado (verificado)</p>
          <p className="mt-1 font-bold text-2xl tabular-nums">{moneda(facturado)}</p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-[var(--texto-suave)] text-xs">Saldo acumulado</p>
          <p className="mt-1 font-bold text-2xl tabular-nums">{moneda(cliente.saldo_acumulado)}</p>
        </Tarjeta>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <FichaCliente
            cliente={{
              id: cliente.id,
              telefono: cliente.telefono,
              nombre_negocio: cliente.nombre_negocio,
              nombre_contacto: cliente.nombre_contacto,
              tipo_negocio: cliente.tipo_negocio,
              modelo_facturacion: cliente.modelo_facturacion,
              canal_origen: cliente.canal_origen,
              aviso_privacidad: cliente.aviso_privacidad_enviado_en !== null,
            }}
            puedeBorrar={sesion?.staff.rol !== 'operador'}
            tienePedidos={pedidos.length > 0}
          />
        </div>

        <Tarjeta className="lg:col-span-2">
          <CabeceraTarjeta titulo={`Historial (${pedidos.length})`} />
          {pedidos.length === 0 ? (
            <Vacio mensaje="Este cliente todavía no tiene pedidos." />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Estado</Th>
                  <Th className="hidden sm:table-cell">Entrega</Th>
                  <Th>Lavado</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido) => (
                  <tr key={pedido.id}>
                    <Td className="whitespace-nowrap">{fechaHora(pedido.created_at)}</Td>
                    <Td>
                      <EtiquetaEstado estado={pedido.estado} />
                    </Td>
                    <Td className="hidden text-[var(--texto-suave)] sm:table-cell">
                      {pedido.tipo_entrega === 'combo'
                        ? 'Combo'
                        : pedido.tipo_entrega === 'a_la_carta'
                          ? 'A la carta'
                          : 'Presencial'}
                    </Td>
                    <Td className="tabular-nums">
                      {pedido.monto_confirmado_lavado !== null
                        ? moneda(pedido.monto_confirmado_lavado)
                        : `${moneda(pedido.monto_estimado_lavado)} est.`}
                    </Td>
                    <Td>
                      <Link
                        className="text-[var(--primario)] text-sm hover:underline"
                        href={`/pedidos/${pedido.id}`}
                      >
                        Ver
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </Tarjeta>
      </div>
    </div>
  )
}
