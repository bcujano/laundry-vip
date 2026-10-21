import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Boton,
  CabeceraTarjeta,
  Etiqueta,
  Seleccion,
  Tabla,
  Tarjeta,
  Td,
  Th,
  Vacio,
} from '@/components/ui/primitivos'
import { exigirPermiso } from '@/lib/auth'
import { fechaHora } from '@/lib/format'
import {
  ETIQUETA_CANAL,
  ETIQUETA_TIPO,
  historial,
  nombresDeProspectos,
} from '@/server/prospectos/bitacora'

export const dynamic = 'force-dynamic'

type Params = { [clave: string]: string | string[] | undefined }
const leer = (params: Params, clave: string) => {
  const valor = params[clave]
  return (Array.isArray(valor) ? valor[0] : valor) ?? ''
}

export default async function HistorialProspectos({
  searchParams,
}: {
  searchParams: Promise<Params>
}) {
  if (!(await exigirPermiso('clientes'))) redirect('/')
  const params = await searchParams
  const tipo = leer(params, 'tipo')
  const prospecto = leer(params, 'prospecto')

  // Los nombres se leen aparte: la bitácora solo guarda el id del prospecto.
  const [eventos, porId] = await Promise.all([historial(), nombresDeProspectos()])
  const filas = eventos.filter(
    (e) => (tipo === '' || e.tipo === tipo) && (prospecto === '' || e.prospecto_id === prospecto),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-semibold text-2xl">Historial de prospección</h1>
        <Link className="text-sm underline" href="/prospectos">
          ← Volver a Prospectos
        </Link>
      </div>
      <Tarjeta>
        <CabeceraTarjeta
          titulo={`${filas.length} registros`}
          extra={
            <form className="flex flex-wrap items-center gap-2" method="get">
              <Seleccion aria-label="Tipo" defaultValue={tipo} name="tipo">
                <option value="">Todos los tipos</option>
                {Object.entries(ETIQUETA_TIPO).map(([clave, texto]) => (
                  <option key={clave} value={clave}>
                    {texto}
                  </option>
                ))}
              </Seleccion>
              <Seleccion aria-label="Negocio" defaultValue={prospecto} name="prospecto">
                <option value="">Todos los negocios</option>
                {[...porId.entries()]
                  .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre))
                  .map(([id, p]) => (
                    <option key={id} value={id}>
                      {p.nombre}
                    </option>
                  ))}
              </Seleccion>
              <Boton type="submit" variante="suave">
                Filtrar
              </Boton>
            </form>
          }
        />
        {filas.length === 0 ? (
          <Vacio mensaje="Todavía no hay contactos registrados." />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Cuándo</Th>
                <Th>Negocio</Th>
                <Th>Qué fue</Th>
                <Th>Canal</Th>
                <Th>Resultado</Th>
                <Th>Quién</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((e) => (
                <tr key={e.id}>
                  <Td>{fechaHora(e.ocurrio_en)}</Td>
                  <Td>
                    <span className="font-medium">{porId.get(e.prospecto_id)?.nombre ?? '—'}</span>
                    <span className="block text-[var(--texto-suave)] text-xs">
                      {porId.get(e.prospecto_id)?.segmento ?? ''}
                    </span>
                  </Td>
                  <Td>
                    <Etiqueta
                      tono={
                        e.tipo === 'baja' ? 'peligro' : e.tipo === 'respuesta' ? 'exito' : 'neutro'
                      }
                    >
                      {ETIQUETA_TIPO[e.tipo]}
                    </Etiqueta>
                  </Td>
                  <Td>{e.canal ? ETIQUETA_CANAL[e.canal] : '—'}</Td>
                  <Td>
                    {e.resultado || '—'}
                    {e.detalle ? (
                      <span className="block text-[var(--texto-suave)] text-xs">{e.detalle}</span>
                    ) : null}
                  </Td>
                  <Td>{e.autor}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>
    </div>
  )
}
