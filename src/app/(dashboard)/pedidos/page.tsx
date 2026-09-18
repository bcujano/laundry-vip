import { Download } from 'lucide-react'
import Link from 'next/link'
import { estadoLegible } from '@/components/pedidos/etiquetas'
import { NuevoPedido } from '@/components/pedidos/nuevo-pedido'
import { TablaPedidos } from '@/components/pedidos/tabla-pedidos'
import { Tarjeta, TituloSeccion, Vacio } from '@/components/ui/primitivos'
import { puede, verifyAuth } from '@/lib/auth'
import { listar as listarClientes } from '@/server/clientes/repo'
import { esGrupoPedidos, GRUPOS_PEDIDOS, listar, POR_PAGINA } from '@/server/pedidos/repo'
import { type CanalPedido, ESTADOS_PEDIDO, type EstadoPedido } from '@/types/database'

export const dynamic = 'force-dynamic'

const CANALES: (CanalPedido | 'todos')[] = ['todos', 'whatsapp_agente', 'presencial']

type Params = { [clave: string]: string | string[] | undefined }

function leer(params: Params, clave: string): string {
  const valor = params[clave]
  return Array.isArray(valor) ? (valor[0] ?? '') : (valor ?? '')
}

export default async function Pedidos({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const estado = (leer(params, 'estado') || 'todos') as EstadoPedido | 'todos'
  const canal = (leer(params, 'canal') || 'todos') as CanalPedido | 'todos'
  const pagina = Number.parseInt(leer(params, 'pagina') || '1', 10) || 1
  const grupoCrudo = leer(params, 'grupo')
  const grupo = esGrupoPedidos(grupoCrudo) ? grupoCrudo : undefined
  const dias = Number.parseInt(leer(params, 'dias') || '0', 10) || undefined

  const [resultado, sesion, clientes] = await Promise.all([
    listar({ pagina, estado, canal, grupo, dias }),
    verifyAuth(),
    listarClientes({ pagina: 1 }),
  ])
  const puedeGestionar = sesion !== null && sesion.staff.rol !== 'operador'
  const consulta = `estado=${estado}&canal=${canal}${grupo ? `&grupo=${grupo}` : ''}${dias ? `&dias=${dias}` : ''}`
  const filtroDashboard = [
    grupo ? GRUPOS_PEDIDOS[grupo] : null,
    dias ? `últimos ${dias} días` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-semibold text-2xl">Pedidos</h1>
        <span className="text-[var(--color-texto-apagado)] text-sm">
          {resultado.total} en total
        </span>
        {sesion && puede(sesion.staff.rol, 'reportes') ? (
          <a
            className="boton boton-suave ml-auto inline-flex items-center gap-1.5 text-sm"
            download
            href="/pedidos/exportar"
          >
            <Download size={15} /> Descargar Excel
          </a>
        ) : null}
      </div>

      {filtroDashboard ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-[var(--fondo)] px-3 py-1 font-medium">
            {filtroDashboard}
          </span>
          <Link className="text-[var(--primario)] hover:underline" href="/pedidos">
            Quitar filtro
          </Link>
        </p>
      ) : null}

      <form className="flex flex-wrap items-end gap-2" method="get">
        {grupo ? <input name="grupo" type="hidden" value={grupo} /> : null}
        {dias ? <input name="dias" type="hidden" value={dias} /> : null}
        <div className="flex flex-col gap-1 text-sm">
          <label className="font-medium" htmlFor="filtro-estado">
            Estado
          </label>
          <select
            className="rounded-[var(--radius-control)] border border-[var(--color-borde)] bg-[var(--color-superficie)] px-2 py-1 text-sm"
            defaultValue={estado}
            id="filtro-estado"
            name="estado"
          >
            <option value="todos">Todos</option>
            {ESTADOS_PEDIDO.map((valor) => (
              <option key={valor} value={valor}>
                {estadoLegible(valor)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label className="font-medium" htmlFor="filtro-canal">
            Canal
          </label>
          <select
            className="rounded-[var(--radius-control)] border border-[var(--color-borde)] bg-[var(--color-superficie)] px-2 py-1 text-sm"
            defaultValue={canal}
            id="filtro-canal"
            name="canal"
          >
            {CANALES.map((valor) => (
              <option key={valor} value={valor}>
                {valor === 'todos'
                  ? 'Todos'
                  : valor === 'presencial'
                    ? 'Presencial'
                    : 'Agente WhatsApp'}
              </option>
            ))}
          </select>
        </div>

        <button
          className="rounded-[var(--radius-control)] bg-[var(--color-primario)] px-3 py-1.5 font-medium text-sm text-white"
          type="submit"
        >
          Filtrar
        </button>
      </form>

      <Tarjeta>
        <TituloSeccion>
          Página {resultado.pagina} de {resultado.paginas} · {POR_PAGINA} por página
        </TituloSeccion>
        {resultado.pedidos.length === 0 ? (
          <Vacio
            mensaje={
              estado === 'todos' && canal === 'todos' && !filtroDashboard
                ? 'Todavía no hay pedidos. El primero llegará por el agente de WhatsApp o desde el local.'
                : 'Ningún pedido coincide con ese filtro.'
            }
          />
        ) : (
          <TablaPedidos pedidos={resultado.pedidos} puedeBorrar={puedeGestionar} />
        )}
      </Tarjeta>

      {resultado.paginas > 1 ? (
        <nav className="flex gap-3 text-sm">
          {resultado.pagina > 1 ? (
            <Link
              className="underline"
              href={`/pedidos?${consulta}&pagina=${resultado.pagina - 1}`}
            >
              ← Anterior
            </Link>
          ) : null}
          {resultado.pagina < resultado.paginas ? (
            <Link
              className="underline"
              href={`/pedidos?${consulta}&pagina=${resultado.pagina + 1}`}
            >
              Siguiente →
            </Link>
          ) : null}
        </nav>
      ) : null}

      {puedeGestionar ? (
        <div className="max-w-xl">
          <NuevoPedido
            clientes={clientes.clientes.map((cliente) => ({
              id: cliente.id,
              nombre: cliente.nombre_negocio || cliente.nombre_contacto || cliente.telefono,
            }))}
          />
        </div>
      ) : null}
    </div>
  )
}
