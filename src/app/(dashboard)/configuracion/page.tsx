import { redirect } from 'next/navigation'
import { FormularioConfiguracion } from '@/components/configuracion/formularios'
import { ListaBlanca } from '@/components/configuracion/lista-blanca'
import { Tarjeta, TituloSeccion } from '@/components/ui/primitivos'
import { exigirPermiso } from '@/lib/auth'
import { fechaHora } from '@/lib/format'
import { listarWhitelist, obtener, parametrosVentana } from '@/server/configuracion/repo'
import { obtenerProximaVentana, ultimaHoraDelDia } from '@/server/scheduling/ventana'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionPagina() {
  // Se vuelve a exigir el permiso aquí: ocultar el enlace no es control.
  if (!(await exigirPermiso('configuracion'))) redirect('/')

  const [config, operadores, parametros] = await Promise.all([
    obtener(),
    listarWhitelist(),
    parametrosVentana(),
  ])
  const ventana = obtenerProximaVentana(new Date(), parametros)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-semibold text-2xl">Configuración</h1>

      <Tarjeta>
        <TituloSeccion>Efecto del horario ahora mismo</TituloSeccion>
        <dl className="grid gap-2 p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[var(--color-texto-apagado)]">Próxima recolección</dt>
            <dd>{fechaHora(ventana.inicio)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-texto-apagado)]">Cierra</dt>
            <dd>{fechaHora(ventana.fin)}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-texto-apagado)]">Última orden del mismo día</dt>
            <dd>{ultimaHoraDelDia(parametros)}</dd>
          </div>
        </dl>
      </Tarjeta>

      <Tarjeta>
        <TituloSeccion>Negocio y horario</TituloSeccion>
        <FormularioConfiguracion config={config} />
      </Tarjeta>

      <Tarjeta>
        <TituloSeccion>Operadores autorizados por WhatsApp</TituloSeccion>
        <ListaBlanca operadores={operadores} />
      </Tarjeta>
    </div>
  )
}
