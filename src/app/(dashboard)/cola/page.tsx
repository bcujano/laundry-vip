import { TablaPedidos } from '@/components/pedidos/tabla-pedidos'
import { CabeceraTarjeta, Tarjeta, Vacio } from '@/components/ui/primitivos'
import { verifyAuth } from '@/lib/auth'
import { fechaHora, soloFecha } from '@/lib/format'
import { parametrosVentana } from '@/server/configuracion/repo'
import { colaDeHoy } from '@/server/pedidos/repo'
import { obtenerProximaVentana } from '@/server/scheduling/ventana'

export const dynamic = 'force-dynamic'

export default async function ColaDeHoy() {
  const ahora = new Date()
  const sesion = await verifyAuth()
  const [pedidos, parametros] = await Promise.all([colaDeHoy(ahora), parametrosVentana()])
  const proxima = obtenerProximaVentana(ahora, parametros)
  const nuevos = pedidos.filter((pedido) => pedido.estado === 'nuevo').length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-bold text-2xl tracking-tight">Cola de hoy</h1>
        <span className="text-[var(--texto-suave)] text-sm">{soloFecha(ahora)}</span>
        {nuevos > 0 ? (
          <span className="rounded-md bg-[var(--primario)] px-2 py-0.5 font-medium text-white text-xs">
            {nuevos} sin atender
          </span>
        ) : null}
      </div>

      <Tarjeta>
        <CabeceraTarjeta
          titulo={`${pedidos.length} recolección(es) programadas`}
          extra={
            <span className="text-[var(--texto-suave)] text-xs">
              Próxima ventana: {fechaHora(proxima.inicio)}
            </span>
          }
        />
        {pedidos.length === 0 ? (
          <Vacio mensaje="No hay recolecciones agendadas para hoy. Cuando el agente confirme un pedido, aparecerá aquí en orden de hora." />
        ) : (
          <TablaPedidos
            mostrarHora
            pedidos={pedidos}
            puedeBorrar={sesion?.staff.rol !== 'operador'}
          />
        )}
      </Tarjeta>
    </div>
  )
}
