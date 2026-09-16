import { Tarjeta, TituloSeccion } from '@/components/ui/primitivos'

export default function CargandoClientes() {
  return (
    <Tarjeta>
      <TituloSeccion>Clientes</TituloSeccion>
      <p className="px-4 py-10 text-center text-[var(--color-texto-apagado)] text-sm">
        Cargando clientes…
      </p>
    </Tarjeta>
  )
}
