'use client'

import { Boton, Tarjeta, TituloSeccion } from '@/components/ui/primitivos'

export default function ErrorConfiguracion({ reset }: { error: Error; reset: () => void }) {
  return (
    <Tarjeta>
      <TituloSeccion>Configuración</TituloSeccion>
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm">No se pudo cargar la configuración.</p>
        <Boton onClick={reset}>Reintentar</Boton>
      </div>
    </Tarjeta>
  )
}
