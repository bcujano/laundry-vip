import { ArrowRight, Search } from 'lucide-react'
import Link from 'next/link'
import { NuevoCliente } from '@/components/clientes/ficha'
import {
  CabeceraTarjeta,
  Etiqueta,
  Tabla,
  Tarjeta,
  Td,
  Th,
  Vacio,
} from '@/components/ui/primitivos'
import { verifyAuth } from '@/lib/auth'
import { soloFecha, telefonoLegible, tipoNegocioLegible } from '@/lib/format'
import { esSegmentoClientes, listar, POR_PAGINA, SEGMENTOS_CLIENTES } from '@/server/clientes/repo'
import type { TipoNegocio } from '@/types/database'

export const dynamic = 'force-dynamic'

const TIPOS: (TipoNegocio | 'todos')[] = [
  'todos',
  'clinica',
  'restaurante',
  'hotel',
  'particular',
  'otro',
]

type Params = { [clave: string]: string | string[] | undefined }

function leer(params: Params, clave: string): string {
  const valor = params[clave]
  return Array.isArray(valor) ? (valor[0] ?? '') : (valor ?? '')
}

export default async function Clientes({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const tipo = (leer(params, 'tipo') || 'todos') as TipoNegocio | 'todos'
  const busqueda = leer(params, 'q')
  const pagina = Number.parseInt(leer(params, 'pagina') || '1', 10) || 1
  const segmentoCrudo = leer(params, 'segmento')
  const segmento = esSegmentoClientes(segmentoCrudo) ? segmentoCrudo : undefined
  const canal =
    leer(params, 'canal') === 'whatsapp_agente' ? ('whatsapp_agente' as const) : undefined

  const [resultado, sesion] = await Promise.all([
    listar({ pagina, tipoNegocio: tipo, busqueda, segmento, canal }),
    verifyAuth(),
  ])
  const consulta = `tipo=${tipo}&q=${encodeURIComponent(busqueda)}${segmento ? `&segmento=${segmento}` : ''}${canal ? `&canal=${canal}` : ''}`
  const filtroDashboard = [
    segmento ? SEGMENTOS_CLIENTES[segmento] : null,
    canal ? 'Llegaron por el agente de WhatsApp' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-bold text-2xl tracking-tight">Clientes</h1>
        <span className="text-[var(--texto-suave)] text-sm">{resultado.total} en total</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-3 xl:col-span-2">
          {filtroDashboard ? (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-[var(--fondo)] px-3 py-1 font-medium">
                {filtroDashboard}
              </span>
              <Link className="text-[var(--primario)] hover:underline" href="/clientes">
                Quitar filtro
              </Link>
            </p>
          ) : null}
          <form className="flex flex-wrap items-end gap-2" method="get">
            {segmento ? <input name="segmento" type="hidden" value={segmento} /> : null}
            {canal ? <input name="canal" type="hidden" value={canal} /> : null}
            <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm" htmlFor="buscar">
              <span className="font-medium">Buscar</span>
              <input
                className="campo"
                defaultValue={busqueda}
                id="buscar"
                name="q"
                placeholder="negocio, contacto o teléfono"
                type="search"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm" htmlFor="tipo">
              <span className="font-medium">Tipo</span>
              <select className="campo w-40" defaultValue={tipo} id="tipo" name="tipo">
                {TIPOS.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion === 'todos' ? 'Todos' : tipoNegocioLegible(opcion)}
                  </option>
                ))}
              </select>
            </label>
            <button className="boton boton-primario" type="submit">
              <Search size={16} /> Filtrar
            </button>
          </form>

          <Tarjeta>
            <CabeceraTarjeta
              titulo={`Página ${resultado.pagina} de ${resultado.paginas} · ${POR_PAGINA} por página`}
            />
            {resultado.clientes.length === 0 ? (
              <Vacio
                mensaje={
                  busqueda || tipo !== 'todos' || filtroDashboard
                    ? 'Ningún cliente coincide con ese filtro.'
                    : 'Todavía no hay clientes. Crea uno aquí al lado, o espera al primero del agente.'
                }
              />
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <Th>Negocio</Th>
                    <Th className="hidden sm:table-cell">Contacto</Th>
                    <Th>Teléfono</Th>
                    <Th className="hidden md:table-cell">Tipo</Th>
                    <Th className="hidden lg:table-cell">Facturación</Th>
                    <Th className="hidden lg:table-cell">Alta</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.clientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <Td>
                        <Link
                          className="font-medium hover:underline"
                          href={`/clientes/${cliente.id}`}
                        >
                          {cliente.nombre_negocio || cliente.nombre_contacto || 'Sin nombre'}
                        </Link>
                      </Td>
                      <Td className="hidden text-[var(--texto-suave)] sm:table-cell">
                        {cliente.nombre_contacto ?? '—'}
                      </Td>
                      <Td className="tabular-nums">{telefonoLegible(cliente.telefono)}</Td>
                      <Td className="hidden md:table-cell">
                        {tipoNegocioLegible(cliente.tipo_negocio)}
                      </Td>
                      <Td className="hidden lg:table-cell">
                        {cliente.modelo_facturacion === 'consolidado_mensual' ? (
                          <Etiqueta tono="aviso">Mensual</Etiqueta>
                        ) : (
                          <span className="text-[var(--texto-suave)] text-xs">Por pedido</span>
                        )}
                      </Td>
                      <Td className="hidden text-[var(--texto-suave)] lg:table-cell">
                        {soloFecha(cliente.created_at)}
                      </Td>
                      <Td>
                        <Link
                          aria-label={`Abrir la ficha de ${cliente.nombre_negocio ?? cliente.telefono}`}
                          className="flex justify-end text-[var(--texto-suave)] hover:text-[var(--primario)]"
                          href={`/clientes/${cliente.id}`}
                        >
                          <ArrowRight size={16} />
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Tarjeta>

          {resultado.paginas > 1 ? (
            <nav className="flex gap-3 text-sm">
              {resultado.pagina > 1 ? (
                <Link
                  className="text-[var(--primario)] hover:underline"
                  href={`/clientes?${consulta}&pagina=${resultado.pagina - 1}`}
                >
                  ← Anterior
                </Link>
              ) : null}
              {resultado.pagina < resultado.paginas ? (
                <Link
                  className="text-[var(--primario)] hover:underline"
                  href={`/clientes?${consulta}&pagina=${resultado.pagina + 1}`}
                >
                  Siguiente →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>

        {sesion && sesion.staff.rol !== 'operador' ? <NuevoCliente /> : null}
      </div>
    </div>
  )
}
