import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AccionesProspecto, NotasProspecto } from '@/components/prospectos/acciones'
import { RegistroContacto } from '@/components/prospectos/registro-contacto'
import {
  Boton,
  CabeceraTarjeta,
  Etiqueta,
  Seleccion,
  Tabla,
  Tarjeta,
  Td,
  Th,
  type Tono,
  Vacio,
} from '@/components/ui/primitivos'
import { exigirPermiso } from '@/lib/auth'
import { fechaHora, telefonoLegible } from '@/lib/format'
import { ETIQUETA_TIPO, historial } from '@/server/prospectos/bitacora'
import { ETIQUETA_ETAPA, type Etapa } from '@/server/prospectos/etapa'
import { type FilaProspecto, listarProspectos } from '@/server/prospectos/repo'
import { resumirProspectos } from '@/server/prospectos/resumen'
import type { CoberturaProspecto } from '@/types/database'

export const dynamic = 'force-dynamic'

type Params = { [clave: string]: string | string[] | undefined }
const leer = (params: Params, clave: string) => {
  const valor = params[clave]
  return (Array.isArray(valor) ? valor[0] : valor) ?? ''
}

const TONO_ETAPA: Record<Etapa, Tono> = {
  nuevo: 'neutro',
  contactado: 'aviso',
  respondio: 'exito',
  cliente: 'primario',
  descartado: 'neutro',
  no_contactar: 'peligro',
}

const COBERTURA: Record<CoberturaProspecto, { texto: string; tono: Tono }> = {
  dentro: { texto: 'Dentro de la zona', tono: 'exito' },
  dudoso: { texto: 'En el borde', tono: 'aviso' },
  fuera: { texto: 'Fuera de la zona', tono: 'peligro' },
  sin_ubicar: { texto: 'Sin ubicar', tono: 'neutro' },
}

function Telefono({ p }: { p: FilaProspecto }) {
  if (p.telefono === null)
    return <span className="text-[var(--texto-suave)] text-xs">Sin teléfono</span>
  if (p.tipo_telefono === 'celular') {
    return (
      <a
        className="tabular-nums underline"
        href={`https://wa.me/${p.telefono.replace('+', '')}`}
        rel="noreferrer"
        target="_blank"
        title="Abrir WhatsApp"
      >
        {telefonoLegible(p.telefono)}
      </a>
    )
  }
  return (
    <a className="tabular-nums underline" href={`tel:${p.telefono}`} title="Llamar">
      {telefonoLegible(p.telefono)}{' '}
      <span className="text-[var(--texto-suave)] text-xs">(fijo)</span>
    </a>
  )
}

export default async function Prospectos({ searchParams }: { searchParams: Promise<Params> }) {
  // Se vuelve a exigir el permiso aquí: ocultar el enlace no es control.
  if (!(await exigirPermiso('clientes'))) redirect('/')

  const params = await searchParams
  const etapa = leer(params, 'etapa')
  const segmento = leer(params, 'segmento')
  const telefono = leer(params, 'telefono')
  const cobertura = leer(params, 'cobertura')

  const [todos, contactos] = await Promise.all([listarProspectos(), historial()])
  // Ya vienen de lo más nuevo a lo más viejo: el primero de cada prospecto es su último movimiento.
  const porProspecto = new Map<string, typeof contactos>()
  for (const c of contactos)
    porProspecto.set(c.prospecto_id, [...(porProspecto.get(c.prospecto_id) ?? []), c])
  const resumen = resumirProspectos(todos)
  const segmentos = [...new Set(todos.map((p) => p.segmento))].sort()

  const filas = todos.filter(
    (p) =>
      (etapa === '' || p.etapa === etapa) &&
      (segmento === '' || p.segmento === segmento) &&
      (telefono === '' || p.tipo_telefono === telefono) &&
      (cobertura === '' || p.cobertura === cobertura),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-semibold text-2xl">Prospectos</h1>
        <Link className="text-sm underline" href="/prospectos/historial">
          Ver historial de contactos
        </Link>
        <span className="text-[var(--texto-suave)] text-sm">
          {resumen.total} negocios de la lista de prospección · aún no son clientes
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Por escribir', resumen.porEscribir, 'celulares sin contactar, no fuera de la zona'],
          ['Por llamar', resumen.porLlamar, 'tienen solo teléfono fijo'],
          ['Contactados', resumen.porEtapa.contactado, 'esperando respuesta'],
          ['Respondieron', resumen.porEtapa.respondio, 'le escribieron al agente'],
          ['Ya son clientes', resumen.porEtapa.cliente, 'con al menos un pedido'],
        ].map(([titulo, valor, ayuda]) => (
          <Tarjeta className="p-4" key={String(titulo)}>
            <p className="text-[var(--texto-suave)] text-sm">{titulo}</p>
            <p className="font-semibold text-2xl tabular-nums">{valor}</p>
            <p className="text-[var(--texto-suave)] text-xs">{ayuda}</p>
          </Tarjeta>
        ))}
      </div>

      <Tarjeta>
        <CabeceraTarjeta
          titulo={`${filas.length} de ${todos.length}`}
          extra={
            <form className="flex flex-wrap items-center gap-2" method="get">
              <Seleccion aria-label="Etapa" defaultValue={etapa} name="etapa">
                <option value="">Todas las etapas</option>
                {(Object.keys(ETIQUETA_ETAPA) as Etapa[]).map((e) => (
                  <option key={e} value={e}>
                    {ETIQUETA_ETAPA[e]}
                  </option>
                ))}
              </Seleccion>
              <Seleccion aria-label="Segmento" defaultValue={segmento} name="segmento">
                <option value="">Todos los segmentos</option>
                {segmentos.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Seleccion>
              <Seleccion aria-label="Teléfono" defaultValue={telefono} name="telefono">
                <option value="">Cualquier teléfono</option>
                <option value="celular">Celular</option>
                <option value="fijo">Fijo</option>
                <option value="sin_telefono">Sin teléfono</option>
              </Seleccion>
              <Seleccion aria-label="Zona" defaultValue={cobertura} name="cobertura">
                <option value="">Cualquier zona</option>
                {(Object.keys(COBERTURA) as CoberturaProspecto[]).map((c) => (
                  <option key={c} value={c}>
                    {COBERTURA[c].texto}
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
          <Vacio mensaje="Ningún prospecto con esos filtros." />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Negocio</Th>
                <Th>Teléfono</Th>
                <Th>Zona</Th>
                <Th>Etapa</Th>
                <Th>Contactos</Th>
                <Th>Notas</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <span className="font-medium">{p.nombre}</span>
                    <span className="block text-[var(--texto-suave)] text-xs">
                      {p.segmento}
                      {p.resenas ? ` · ★ ${p.rating} (${p.resenas})` : ''}
                    </span>
                    {p.direccion ? (
                      <span className="block text-[var(--texto-suave)] text-xs">
                        {p.google_maps ? (
                          <a
                            className="underline"
                            href={p.google_maps}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {p.direccion}
                          </a>
                        ) : (
                          p.direccion
                        )}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <Telefono p={p} />
                    {p.email ? (
                      <span className="block text-[var(--texto-suave)] text-xs">{p.email}</span>
                    ) : null}
                  </Td>
                  <Td>
                    <Etiqueta tono={COBERTURA[p.cobertura].tono}>
                      {COBERTURA[p.cobertura].texto}
                    </Etiqueta>
                    {p.distancia_km !== null ? (
                      <span className="block text-[var(--texto-suave)] text-xs tabular-nums">
                        a {String(p.distancia_km).replace('.', ',')} km
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <Etiqueta tono={TONO_ETAPA[p.etapa]}>{ETIQUETA_ETAPA[p.etapa]}</Etiqueta>
                  </Td>
                  <Td>
                    {(() => {
                      const suyos = porProspecto.get(p.id) ?? []
                      const ultimo = suyos[0]
                      return (
                        <>
                          {ultimo ? (
                            <span className="block text-xs">
                              {suyos.length} · último: {ETIQUETA_TIPO[ultimo.tipo]},{' '}
                              {fechaHora(ultimo.ocurrio_en)}
                              {ultimo.resultado ? ` (${ultimo.resultado})` : ''}
                            </span>
                          ) : (
                            <span className="block text-[var(--texto-suave)] text-xs">
                              Sin contactos
                            </span>
                          )}
                          {p.etapa === 'cliente' ? null : (
                            <RegistroContacto id={p.id} primero={suyos.length === 0} />
                          )}
                        </>
                      )
                    })()}
                  </Td>
                  <Td>
                    <NotasProspecto id={p.id} notas={p.notas} />
                  </Td>
                  <Td>
                    <AccionesProspecto etapa={p.etapa} id={p.id} nombre={p.nombre} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>
    </div>
  )
}
