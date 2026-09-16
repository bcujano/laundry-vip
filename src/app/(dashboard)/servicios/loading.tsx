import { Tarjeta, TituloSeccion } from '@/components/ui/primitivos'

export default function CargandoServicios() {
  return (
    <Tarjeta>
      <TituloSeccion>Servicios</TituloSeccion>
      <p className="px-4 py-10 text-center text-[var(--color-texto-apagado)] text-sm">
        Cargando el catálogo…
      </p>
    </Tarjeta>
  )
}
