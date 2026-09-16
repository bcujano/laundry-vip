import Link from 'next/link'
import { Tabla, Tarjeta, Td, Th, TituloSeccion, Vacio } from '@/components/ui/primitivos'
import { moneda, soloFecha, telefonoLegible, tipoNegocioLegible } from '@/lib/format'
import { listar, POR_PAGINA } from '@/server/clientes/repo'
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

  const resultado = await listar({ pagina, tipoNegocio: tipo, busqueda })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h1 className="font-semibold text-2xl">Clientes</h1>
        <span className="text-[var(--color-texto-apagado)] text-sm">
          {resultado.total} en total
        </span>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <label className="flex flex-col gap-1 text-sm">
          Buscar
          <input
            className="rounded-[var(--radius-control)] border border-[var(--color-borde)] bg-[var(--color-superficie)] px-2 py-1 text-sm"
            defaultValue={busqueda}
            name="q"
            placeholder="negocio, contacto o teléfono"
            type="search"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tipo de negocio
          <select
            className="rounded-[var(--radius-control)] border border-[var(--color-borde)] bg-[var(--color-superficie)] px-2 py-1 text-sm"
            defaultValue={tipo}
            name="tipo"
          >
            {TIPOS.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion === 'todos' ? 'Todos' : tipoNegocioLegible(opcion)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded-[var(--radius-control)] bg-[var(--color-primario)] px-3 py-1.5 font-medium text-sm text-white"
          type="submit"
        >
          Filtrar
        </button>
      </form>

      <Tarjeta>
        <TituloSeccion>
          Página {resultado.pagina} de {resultado.paginas}
        </TituloSeccion>

        {resultado.clientes.length === 0 ? (
          <Vacio
            mensaje={
              busqueda || tipo !== 'todos'
                ? 'Ningún cliente coincide con ese filtro.'
                : 'Todavía no hay clientes. El primero entrará por el agente de WhatsApp o desde el local.'
            }
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Negocio</Th>
                <Th>Contacto</Th>
                <Th>Teléfono</Th>
                <Th>Tipo</Th>
                <Th>Facturación</Th>
                <Th>Saldo</Th>
                <Th>Alta</Th>
              </tr>
            </thead>
            <tbody>
              {resultado.clientes.map((cliente) => (
                <tr key={cliente.id}>
                  <Td>{cliente.nombre_negocio ?? '—'}</Td>
                  <Td>{cliente.nombre_contacto ?? '—'}</Td>
                  <Td className="tabular-nums">{telefonoLegible(cliente.telefono)}</Td>
                  <Td>{tipoNegocioLegible(cliente.tipo_negocio)}</Td>
                  <Td className="text-[var(--color-texto-apagado)]">
                    {cliente.modelo_facturacion === 'consolidado_mensual'
                      ? 'Mensual'
                      : 'Por pedido'}
                  </Td>
                  <Td className="tabular-nums">{moneda(cliente.saldo_acumulado)}</Td>
                  <Td className="text-[var(--color-texto-apagado)]">
                    {soloFecha(cliente.created_at)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>

      {resultado.paginas > 1 ? (
        <nav className="flex gap-2 text-sm">
          {resultado.pagina > 1 ? (
            <Link
              className="underline"
              href={`/clientes?tipo=${tipo}&q=${encodeURIComponent(busqueda)}&pagina=${resultado.pagina - 1}`}
            >
              ← Anterior
            </Link>
          ) : null}
          {resultado.pagina < resultado.paginas ? (
            <Link
              className="underline"
              href={`/clientes?tipo=${tipo}&q=${encodeURIComponent(busqueda)}&pagina=${resultado.pagina + 1}`}
            >
              Siguiente →
            </Link>
          ) : null}
          <span className="text-[var(--color-texto-apagado)]">{POR_PAGINA} por página</span>
        </nav>
      ) : null}
    </div>
  )
}
