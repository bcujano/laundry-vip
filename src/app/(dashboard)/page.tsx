import { TablaPedidos } from '@/components/pedidos/tabla-pedidos'
import { Tarjeta, TituloSeccion, Vacio } from '@/components/ui/primitivos'
import { fechaHora, soloFecha } from '@/lib/format'
import { parametrosVentana } from '@/server/configuracion/repo'
import { colaDeHoy } from '@/server/pedidos/repo'
import { obtenerProximaVentana } from '@/server/scheduling/ventana'

export const dynamic = 'force-dynamic'

export default async function ColaDeHoy() {
  const ahora = new Date()
  const [pedidos, parametros] = await Promise.all([colaDeHoy(ahora), parametrosVentana()])
  const proxima = obtenerProximaVentana(ahora, parametros)
  const nuevos = pedidos.filter((p) => p.estado === 'nuevo').length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-semibold text-2xl">Cola de hoy</h1>
        <span className="text-[var(--color-texto-apagado)] text-sm">{soloFecha(ahora)}</span>
        {nuevos > 0 ? (
          <span className="rounded-[var(--radius-control)] bg-[var(--color-primario)] px-2 py-0.5 text-white text-xs">
            {nuevos} sin atender
          </span>
        ) : null}
        <span className="ml-auto text-[var(--color-texto-apagado)] text-sm">
          Próxima ventana: {fechaHora(proxima.inicio)}
        </span>
      </div>

      <Tarjeta>
        <TituloSeccion>{pedidos.length} recolección(es) programadas para hoy</TituloSeccion>
        {pedidos.length === 0 ? (
          <Vacio mensaje="No hay recolecciones agendadas para hoy. Cuando el agente confirme un pedido, aparecerá aquí en orden de hora." />
        ) : (
          <TablaPedidos mostrarHora pedidos={pedidos} />
        )}
      </Tarjeta>
    </div>
  )
}
