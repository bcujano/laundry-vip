'use client'

import { Boton, Tarjeta } from '@/components/ui/primitivos'

export default function ErrorPedidos({ reset }: { error: Error; reset: () => void }) {
  return (
    <Tarjeta>
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm">No se pudieron cargar los pedidos.</p>
        <Boton onClick={reset}>Reintentar</Boton>
      </div>
    </Tarjeta>
  )
}
