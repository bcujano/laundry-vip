'use client'

import { Boton, Tarjeta } from '@/components/ui/primitivos'

export default function ErrorReportes({ reset }: { error: Error; reset: () => void }) {
  return (
    <Tarjeta>
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm">No se pudo generar el reporte.</p>
        <Boton onClick={reset}>Reintentar</Boton>
      </div>
    </Tarjeta>
  )
}
