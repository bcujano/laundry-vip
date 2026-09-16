import { ArrowRight, Flame, MessageCircle, TrendingUp, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { CabeceraTarjeta, Tarjeta, Vacio } from '@/components/ui/primitivos'
import { fechaHora, telefonoLegible } from '@/lib/format'
import type { EmbudoLeads } from '@/server/dashboard/leads'

const TEMPERATURA: Record<string, { texto: string; clase: string }> = {
  caliente: { texto: 'Caliente', clase: 'text-[var(--peligro)]' },
  tibio: { texto: 'Tibio', clase: 'text-[var(--aviso)]' },
  frio: { texto: 'Frío', clase: 'text-[var(--texto-suave)]' },
}

function Cifra({
  titulo,
  valor,
  pie,
  icono,
  href,
}: {
  titulo: string
  valor: string
  pie: string
  icono: React.ReactNode
  href: string
}) {
  return (
    <Link className="flex items-start gap-3 p-4 transition hover:bg-[var(--fondo)]" href={href}>
      <span className="rounded-lg bg-[var(--fondo)] p-2 text-[var(--primario)]">{icono}</span>
      <div className="min-w-0">
        <p className="text-[var(--texto-suave)] text-xs">{titulo}</p>
        <p className="font-bold text-xl tabular-nums">{valor}</p>
        <p className="text-[var(--texto-suave)] text-xs">{pie}</p>
      </div>
    </Link>
  )
}

/** Todo el que le escribió al agente, haya pedido o no. */
export function SeccionLeads({ datos }: { datos: EmbudoLeads }) {
  return (
    <Tarjeta>
      <CabeceraTarjeta
        extra={
          <Link
            className="text-[var(--primario)] text-xs hover:underline"
            href="/clientes?segmento=sin_pedidos"
          >
            Ver leads sin pedido →
          </Link>
        }
        titulo="Leads de WhatsApp (30 días)"
      />
      <div className="grid divide-[var(--borde)] border-[var(--borde)] border-b sm:grid-cols-2 sm:divide-x xl:grid-cols-4">
        <Cifra
          href="/clientes?canal=whatsapp_agente"
          icono={<MessageCircle size={16} />}
          pie={`${datos.leadsHoy} hoy`}
          titulo="Leads nuevos"
          valor={String(datos.leads30)}
        />
        <Cifra
          href="/clientes?segmento=con_pedidos"
          icono={<UserCheck size={16} />}
          pie="hicieron al menos un pedido"
          titulo="Convertidos"
          valor={String(datos.convertidos30)}
        />
        <Cifra
          href="/reportes?periodo=mes"
          icono={<TrendingUp size={16} />}
          pie="de leads a pedido"
          titulo="Conversión"
          valor={`${datos.tasaConversion}%`}
        />
        <Cifra
          href="/clientes?segmento=sin_pedidos"
          icono={<Flame size={16} />}
          pie={`${datos.escalados} escalados a humano`}
          titulo="Calientes sin pedido"
          valor={String(datos.calientesSinPedido)}
        />
      </div>

      {datos.sinPedido.length === 0 ? (
        <Vacio mensaje="No hay leads pendientes: todos los que escribieron ya pidieron." />
      ) : (
        <>
          <p className="px-4 pt-3 font-semibold text-sm">Sin pedido todavía</p>
          <ul className="divide-y divide-[var(--borde)]">
            {datos.sinPedido.map((lead) => {
              const temperatura = lead.temperatura ? TEMPERATURA[lead.temperatura] : undefined
              const contenido = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{lead.nombre}</span>
                    <span className="block truncate text-[var(--texto-suave)] text-xs">
                      {lead.necesidad ?? telefonoLegible(lead.telefono)}
                    </span>
                  </span>
                  {temperatura ? (
                    <span className={`shrink-0 font-medium text-xs ${temperatura.clase}`}>
                      {temperatura.texto}
                    </span>
                  ) : null}
                  <span className="hidden shrink-0 text-[var(--texto-suave)] text-xs sm:block">
                    {fechaHora(lead.ultimaInteraccion)}
                  </span>
                  <ArrowRight className="shrink-0 text-[var(--texto-suave)]" size={14} />
                </>
              )
              return (
                <li key={lead.telefono}>
                  {lead.clienteId ? (
                    <Link
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--fondo)]"
                      href={`/clientes/${lead.clienteId}`}
                    >
                      {contenido}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-2.5">{contenido}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Tarjeta>
  )
}
