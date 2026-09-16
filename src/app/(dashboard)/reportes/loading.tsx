import { Tarjeta } from '@/components/ui/primitivos'

export default function CargandoReportes() {
  return (
    <Tarjeta>
      <p className="px-4 py-10 text-center text-[var(--color-texto-apagado)] text-sm">
        Calculando el reporte…
      </p>
    </Tarjeta>
  )
}
