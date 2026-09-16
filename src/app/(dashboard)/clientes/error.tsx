'use client'

import { Boton, Tarjeta, TituloSeccion } from '@/components/ui/primitivos'

export default function ErrorClientes({ reset }: { error: Error; reset: () => void }) {
  return (
    <Tarjeta>
      <TituloSeccion>Clientes</TituloSeccion>
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm">No se pudo cargar la lista de clientes.</p>
        <Boton onClick={reset}>Reintentar</Boton>
      </div>
    </Tarjeta>
  )
}
