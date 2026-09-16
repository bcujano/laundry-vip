import { AlertTriangle, ArrowRight, ClipboardList, DollarSign, Users, Wallet } from 'lucide-react'
import Link from 'next/link'
import { SeccionLeads } from '@/components/dashboard/leads'
import { EtiquetaEstado } from '@/components/pedidos/etiquetas'
import { CabeceraTarjeta, Tarjeta, Vacio } from '@/components/ui/primitivos'
import { verifyAuth } from '@/lib/auth'
import { fechaHora, moneda, soloFecha, soloHora } from '@/lib/format'
import { parametrosVentana } from '@/server/configuracion/repo'
import { embudoLeads } from '@/server/dashboard/leads'
import { type ResumenPedido, tablero } from '@/server/dashboard/repo'
import { obtenerProximaVentana } from '@/server/scheduling/ventana'

export const dynamic = 'force-dynamic'

function Kpi({
  titulo,
  valor,
  pie,
  icono,
  href,
}: {
  titulo: string
  valor: string
  pie: string
  icono: React.ReactNode
  href: string
}) {
  return (
    <Link className="group block" href={href}>
      <Tarjeta className="h-full p-4 transition group-hover:border-[var(--primario)] group-hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-[var(--texto-suave)] text-sm">{titulo}</p>
          <span className="rounded-lg bg-[var(--fondo)] p-2 text-[var(--primario)]">{icono}</span>
        </div>
        <p className="mt-2 font-bold text-2xl tabular-nums">{valor}</p>
        <p className="mt-0.5 text-[var(--texto-suave)] text-xs">{pie}</p>
      </Tarjeta>
    </Link>
  )
}

function ListaAtencion({
  titulo,
  pedidos,
  color,
  grupo,
}: {
  titulo: string
  pedidos: ResumenPedido[]
  color: string
  grupo: string
}) {
  if (pedidos.length === 0) return null

  return (
    <div className="mb-4 last:mb-0">
      <Link
        className={`mb-1.5 flex items-center gap-1 font-semibold text-sm hover:underline ${color}`}
        href={`/pedidos?grupo=${grupo}`}
      >
        {titulo}: {pedidos.length} <ArrowRight size={12} />
      </Link>
      <div className="space-y-1">
        {pedidos.slice(0, 3).map((pedido) => (
          <Link
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--fondo)]"
            href={`/pedidos/${pedido.id}`}
            key={pedido.id}
          >
            <span className="truncate">{pedido.cliente}</span>
            <span className="shrink-0 text-[var(--texto-suave)] text-xs">
              {moneda(pedido.monto)}
            </span>
          </Link>
        ))}
        {pedidos.length > 3 ? (
          <Link
            className="block px-2 text-[var(--primario)] text-xs hover:underline"
            href={`/pedidos?grupo=${grupo}`}
          >
            Ver los {pedidos.length}
          </Link>
        ) : null}
      </div>
    </div>
  )
}

export default async function Dashboard() {
  const ahora = new Date()
  const sesion = await verifyAuth()
  const [datos, parametros, leads] = await Promise.all([
    tablero(ahora),
    parametrosVentana(),
    embudoLeads(ahora),
  ])
  const proxima = obtenerProximaVentana(ahora, parametros)

  const { discrepancias, esperandoPago, sinVerificar } = datos.requierenAtencion
  const totalAtencion = discrepancias.length + esperandoPago.length + sinVerificar.length
  const maximoEmbudo = Math.max(1, ...datos.porEstado.map((fila) => fila.total))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Dashboard</h1>
        <p className="text-[var(--texto-suave)] text-sm">
          Hola {sesion?.staff.nombre_completo.split(' ')[0]} — {soloFecha(ahora)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          href="/cola"
          icono={<ClipboardList size={18} />}
          pie={`${datos.sinAtender} sin atender`}
          titulo="Recolecciones hoy"
          valor={String(datos.pedidosHoy)}
        />
        <Kpi
          href="/reportes?periodo=mes"
          icono={<DollarSign size={18} />}
          pie="lavado ya verificado"
          titulo="Facturado (30 días)"
          valor={moneda(datos.facturadoMes)}
        />
        <Kpi
          href="/pedidos?grupo=por_verificar&dias=30"
          icono={<Wallet size={18} />}
          pie="pendiente de contar en planta"
          titulo="Estimado (30 días)"
          valor={moneda(datos.estimadoMes)}
        />
        <Kpi
          href="/clientes"
          icono={<Users size={18} />}
          pie={`${datos.enPlanta} pedidos en proceso`}
          titulo="Clientes"
          valor={String(datos.clientes)}
        />
      </div>

      <SeccionLeads datos={leads} />

      {totalAtencion > 0 ? (
        <Tarjeta className="border-[var(--peligro)]/25 bg-[var(--peligro-suave)]/40">
          <div className="flex items-center gap-2 px-4 py-3">
            <AlertTriangle className="text-[var(--peligro)]" size={18} />
            <h2 className="font-semibold text-[var(--peligro)] text-sm">
              Requiere atención ({totalAtencion})
            </h2>
          </div>
          <div className="px-4 pb-4">
            <ListaAtencion
              color="text-[var(--peligro)]"
              grupo="discrepancia"
              pedidos={discrepancias}
              titulo="Congelados por discrepancia"
            />
            <ListaAtencion
              color="text-[var(--aviso)]"
              grupo="esperando_pago"
              pedidos={esperandoPago}
              titulo="Esperando pago para despachar"
            />
            <ListaAtencion
              color="text-[var(--texto-suave)]"
              grupo="sin_verificar"
              pedidos={sinVerificar}
              titulo="Recolectados sin contar en planta"
            />
          </div>
        </Tarjeta>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <CabeceraTarjeta
            extra={
              <Link className="text-[var(--primario)] text-xs hover:underline" href="/cola">
                Ver cola completa →
              </Link>
            }
            titulo={`Cola de hoy · próxima ventana ${fechaHora(proxima.inicio)}`}
          />
          {datos.colaDeHoy.length === 0 ? (
            <Vacio mensaje="No hay recolecciones agendadas para hoy. Cuando el agente confirme un pedido aparecerá aquí." />
          ) : (
            <ul className="divide-y divide-[var(--borde)]">
              {datos.colaDeHoy.map((pedido) => (
                <li key={pedido.id}>
                  <Link
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--fondo)]"
                    href={`/pedidos/${pedido.id}`}
                  >
                    <span className="w-12 shrink-0 font-medium text-sm tabular-nums">
                      {soloHora(pedido.ventana)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{pedido.cliente}</span>
                    <EtiquetaEstado estado={pedido.estado} />
                    <span className="hidden w-16 text-right text-sm tabular-nums sm:block">
                      {moneda(pedido.monto)}
                    </span>
                    <ArrowRight className="shrink-0 text-[var(--texto-suave)]" size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta>
          <CabeceraTarjeta
            extra={
              <Link className="text-[var(--primario)] text-xs hover:underline" href="/pipeline">
                Ver pipeline →
              </Link>
            }
            titulo="Pedidos por estado (30 días)"
          />
          {datos.porEstado.length === 0 ? (
            <Vacio mensaje="Todavía no hay pedidos." />
          ) : (
            <div className="flex flex-col gap-2 p-4">
              {datos.porEstado.map((fila) => (
                <Link
                  className="flex items-center gap-2 rounded hover:bg-[var(--fondo)]"
                  href={`/pedidos?estado=${fila.estado}&dias=30`}
                  key={fila.estado}
                >
                  <div className="w-28 shrink-0">
                    <EtiquetaEstado estado={fila.estado} />
                  </div>
                  <div className="h-5 min-w-0 flex-1 rounded bg-[var(--fondo)]">
                    <div
                      className="flex h-5 items-center justify-end rounded bg-[var(--primario)] px-1.5 font-medium text-[10px] text-white"
                      style={{ width: `${Math.max(8, (fila.total / maximoEmbudo) * 100)}%` }}
                    >
                      {fila.total}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Tarjeta>
      </div>
    </div>
  )
}
