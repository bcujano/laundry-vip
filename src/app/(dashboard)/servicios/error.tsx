'use client'

import { Boton, Tarjeta, TituloSeccion } from '@/components/ui/primitivos'

export default function ErrorServicios({ reset }: { error: Error; reset: () => void }) {
  return (
    <Tarjeta>
      <TituloSeccion>Servicios</TituloSeccion>
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm">No se pudo cargar el catálogo.</p>
        <Boton onClick={reset}>Reintentar</Boton>
      </div>
    </Tarjeta>
  )
}
