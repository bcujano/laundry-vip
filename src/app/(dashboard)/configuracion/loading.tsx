import { Tarjeta, TituloSeccion } from '@/components/ui/primitivos'

export default function CargandoConfiguracion() {
  return (
    <Tarjeta>
      <TituloSeccion>Configuración</TituloSeccion>
      <p className="px-4 py-10 text-center text-[var(--color-texto-apagado)] text-sm">Cargando…</p>
    </Tarjeta>
  )
}
