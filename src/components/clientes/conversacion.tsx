import { CabeceraTarjeta, Tarjeta, Vacio } from '@/components/ui/primitivos'
import { fechaHora } from '@/lib/format'
import type { Conversacion } from '@/types/database'

/**
 * Lo que el agente de WhatsApp dejó registrado en el último turno. Es una
 * lectura: el contexto lo escribe n8n, nunca el operador.
 */
const TEMPERATURA: Record<string, string> = {
  frio: 'Frío',
  tibio: 'Tibio',
  caliente: 'Caliente',
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

export function ConversacionAgente({ conversacion }: { conversacion: Conversacion | null }) {
  if (!conversacion) {
    return (
      <Tarjeta>
        <CabeceraTarjeta titulo="Conversación con el agente" />
        <Vacio mensaje="Este cliente todavía no ha escrito por WhatsApp." />
      </Tarjeta>
    )
  }

  const c = conversacion.contexto
  const chatwoot = texto(c.chatwoot_url)
  const filas: [string, string | null][] = [
    ['Última interacción', fechaHora(conversacion.ultima_interaccion)],
    ['Nombre en WhatsApp', texto(c.nombre_whatsapp)],
    ['Interés', TEMPERATURA[String(c.temperatura)] ?? texto(c.temperatura)],
    ['Qué necesita', texto(c.necesidad)],
    ['Siguiente paso', texto(c.proxima_accion)],
    ['Último mensaje del cliente', texto(c.ultimo_mensaje_cliente)],
    ['Última respuesta del agente', texto(c.ultima_respuesta_agente)],
    ['Escalado a humano', c.escalado === true ? 'Sí' : null],
  ]

  return (
    <Tarjeta>
      <CabeceraTarjeta
        titulo="Conversación con el agente"
        extra={
          chatwoot ? (
            <a
              className="text-[var(--primario)] text-sm hover:underline"
              href={chatwoot}
              rel="noreferrer"
              target="_blank"
            >
              Abrir en Chatwoot
            </a>
          ) : null
        }
      />
      <dl className="grid gap-3 p-4 text-sm">
        {filas
          .filter(([, valor]) => valor)
          .map(([etiqueta, valor]) => (
            <div key={etiqueta}>
              <dt className="text-[var(--texto-suave)] text-xs">{etiqueta}</dt>
              <dd className="mt-0.5 whitespace-pre-line">{valor}</dd>
            </div>
          ))}
      </dl>
    </Tarjeta>
  )
}
