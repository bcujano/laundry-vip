import { redirect } from 'next/navigation'
import { Tabla, Tarjeta, Td, Th, TituloSeccion, Vacio } from '@/components/ui/primitivos'
import { exigirPermiso } from '@/lib/auth'
import { moneda, soloFecha, tipoNegocioLegible } from '@/lib/format'
import { generar, periodoDesdeNombre } from '@/server/reportes/repo'

export const dynamic = 'force-dynamic'

const PERIODOS = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: 'semana', texto: 'Últimos 7 días' },
  { clave: 'mes', texto: 'Últimos 30 días' },
]

type Params = { [clave: string]: string | string[] | undefined }

export default async function Reportes({ searchParams }: { searchParams: Promise<Params> }) {
  if (!(await exigirPermiso('reportes'))) redirect('/')

  const params = await searchParams
  const crudo = params.periodo
  const periodoClave = (Array.isArray(crudo) ? crudo[0] : crudo) || 'mes'

  const periodo = periodoDesdeNombre(periodoClave)
  const reporte = await generar(periodo)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-semibold text-2xl">Reportes</h1>
        <span className="text-[var(--color-texto-apagado)] text-sm">
          {soloFecha(reporte.desde)} — {soloFecha(reporte.hasta)}
        </span>
      </div>

      <nav className="flex gap-3 text-sm">
        {PERIODOS.map((opcion) => (
          <a
            className={
              opcion.clave === periodoClave
                ? 'font-medium underline'
                : 'text-[var(--color-texto-apagado)] underline'
            }
            href={`/reportes?periodo=${opcion.clave}`}
            key={opcion.clave}
          >
            {opcion.texto}
          </a>
        ))}
      </nav>

      <div className="grid gap-3 sm:grid-cols-4">
        <Tarjeta className="p-4">
          <p className="text-[var(--color-texto-apagado)] text-xs">Pedidos</p>
          <p className="font-semibold text-2xl tabular-nums">{reporte.total_pedidos}</p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-[var(--color-texto-apagado)] text-xs">Lavado confirmado</p>
          <p className="font-semibold text-2xl tabular-nums">
            {moneda(reporte.total_confirmado_usd)}
          </p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-[var(--color-texto-apagado)] text-xs">
            Lavado estimado ({reporte.pedidos_sin_verificar} sin verificar)
          </p>
          <p className="font-semibold text-2xl tabular-nums">
            {moneda(reporte.total_estimado_usd)}
          </p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-[var(--color-texto-apagado)] text-xs">Transporte cobrado</p>
          <p className="font-semibold text-2xl tabular-nums">
            {moneda(reporte.total_transporte_usd)}
          </p>
        </Tarjeta>
      </div>

      <Tarjeta>
        <TituloSeccion>Por tipo de negocio</TituloSeccion>
        {reporte.por_tipo_negocio.length === 0 ? (
          <Vacio mensaje="No hubo pedidos facturables en este período." />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Tipo</Th>
                <Th>Pedidos</Th>
                <Th>Lavado confirmado</Th>
                <Th>Lavado estimado</Th>
                <Th>Transporte</Th>
              </tr>
            </thead>
            <tbody>
              {reporte.por_tipo_negocio.map((fila) => (
                <tr key={fila.tipo_negocio}>
                  <Td>{tipoNegocioLegible(fila.tipo_negocio)}</Td>
                  <Td className="tabular-nums">{fila.pedidos}</Td>
                  <Td className="tabular-nums">{moneda(fila.confirmado_usd)}</Td>
                  <Td className="tabular-nums text-[var(--color-texto-apagado)]">
                    {moneda(fila.estimado_usd)}
                  </Td>
                  <Td className="tabular-nums">{moneda(fila.transporte_usd)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>
    </div>
  )
}
