import { FilaPrecio } from '@/components/servicios/fila-precio'
import { Tabla, Tarjeta, Th, TituloSeccion, Vacio } from '@/components/ui/primitivos'
import { verifyAuth } from '@/lib/auth'
import { contar, listarPorCategoria } from '@/server/servicios/repo'

export const dynamic = 'force-dynamic'

export default async function Servicios() {
  const sesion = await verifyAuth()
  const editable = sesion?.staff.rol === 'superadmin'
  const [categorias, total] = await Promise.all([listarPorCategoria(), contar()])

  if (categorias.length === 0) {
    return (
      <Tarjeta>
        <TituloSeccion>Servicios</TituloSeccion>
        <Vacio mensaje="El catálogo está vacío. Corre la siembra para cargar la lista de la planta." />
      </Tarjeta>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h1 className="font-semibold text-2xl">Servicios</h1>
        <span className="text-[var(--color-texto-apagado)] text-sm">
          {total} ítems del catálogo
        </span>
        {!editable ? (
          <span className="text-[var(--color-texto-apagado)] text-sm">
            · solo lectura para tu rol
          </span>
        ) : null}
      </div>

      {categorias.map((grupo) => (
        <Tarjeta key={grupo.categoria}>
          <TituloSeccion>
            {grupo.categoria} ({grupo.items.length})
          </TituloSeccion>
          <Tabla>
            <thead>
              <tr>
                <Th>Ítem</Th>
                <Th>Método</Th>
                <Th>Unidad</Th>
                <Th>{editable ? 'Precio mín. / máx.' : 'Precio'}</Th>
              </tr>
            </thead>
            <tbody>
              {grupo.items.map((servicio) => (
                <FilaPrecio editable={editable} key={servicio.id} servicio={servicio} />
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      ))}
    </div>
  )
}
