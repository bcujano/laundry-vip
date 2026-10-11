'use client'

import { cambiarPlantillasAutomaticas } from '@/app/(dashboard)/configuracion/plantillas-actions'
import { BotonAccion } from '@/components/ui/primitivos'

/**
 * Interruptor de los mensajes automáticos por plantilla de WhatsApp. Arranca apagado: se enciende
 * cuando Meta aprobó las plantillas (pnpm tsx scripts/plantillas-meta.ts --estado).
 */
export function InterruptorPlantillas({ activas }: { activas: boolean }) {
  return (
    <div className="flex flex-col gap-3 p-4 text-sm">
      <p>
        Escribe solo a quien ya fue cliente: <strong>reactivación</strong> a los 30 y 90 días a
        quien tiene 2 o más pedidos y no vuelve a pedir, y{' '}
        <strong>aviso de ropa no retirada</strong> a los 7, 30, 60 y 80 días. Nunca a quien pidió
        que no le escriban, ni a quien tiene un pedido abierto, ni más de un mensaje cada 25 días.
        Hoy está <strong>{activas ? 'ENCENDIDO' : 'APAGADO'}</strong>.
      </p>
      <BotonAccion
        confirmacion={
          activas
            ? '¿Apagar los mensajes automáticos por plantilla?'
            : '¿Encender los mensajes automáticos? Meta debe haber aprobado las plantillas; cada mensaje tiene un costo pequeño.'
        }
        onEjecutar={() => cambiarPlantillasAutomaticas(!activas)}
        texto={activas ? 'Apagar mensajes automáticos' : 'Encender mensajes automáticos'}
        variante={activas ? 'peligro' : 'primario'}
      />
    </div>
  )
}
