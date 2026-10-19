import type { CoberturaProspecto, EstadoProspecto, TipoTelefono } from '@/types/database'

/**
 * A quién se le escribe hoy, y en qué orden. Es una función pura: todo lo que depende de la base
 * (quién es del equipo, quién ya nos escribió, cuántos van hoy) llega en `contexto`.
 *
 * Reglas, todas necesarias:
 *  - solo prospectos «nuevos»: nadie les ha escrito ni llamado todavía;
 *  - solo celulares: a un fijo no se le puede escribir por WhatsApp (a ese se le llama);
 *  - nunca quien cae claramente FUERA del radio de recolección;
 *  - nunca a quien ya es del equipo, ya es cliente o ya le escribió al agente (eso es un lead: se le
 *    atiende, no se le escribe en frío), ni a quien pidió que no le escriban;
 *  - nunca más de un mensaje cada 25 días a un mismo teléfono, ni dos primeros contactos al mismo negocio;
 *  - nunca más que el tope diario del dueño.
 */
export type ProspectoElegible = {
  id: string
  nombre: string
  segmento: string
  telefono: string | null
  tipo_telefono: TipoTelefono
  cobertura: CoberturaProspecto
  distancia_km: number | null
  resenas: number | null
  estado: EstadoProspecto
}

export type ContextoDeEnvio = {
  /** Del equipo, ya clientes o leads, o con «no seguir». */
  excluidos: ReadonlySet<string>
  /** Recibieron alguna plantilla en los últimos 25 días. */
  recientes: ReadonlySet<string>
  /** Ids de prospectos a los que ya se les mandó el primer contacto. */
  yaEscritos: ReadonlySet<string>
  enviadosHoy: number
  limiteDiario: number
}

const ORDEN_COBERTURA: Record<CoberturaProspecto, number> = {
  dentro: 0,
  dudoso: 1,
  sin_ubicar: 2,
  fuera: 3,
}

export function elegirProspectos(
  prospectos: readonly ProspectoElegible[],
  contexto: ContextoDeEnvio,
): ProspectoElegible[] {
  const cupo = Math.max(0, contexto.limiteDiario - contexto.enviadosHoy)
  if (cupo === 0) return []

  const vistos = new Set<string>()
  return prospectos
    .filter((p) => {
      if (p.estado !== 'nuevo' || p.tipo_telefono !== 'celular' || p.telefono === null) return false
      if (p.cobertura === 'fuera') return false
      if (contexto.excluidos.has(p.telefono) || contexto.recientes.has(p.telefono)) return false
      if (contexto.yaEscritos.has(p.id)) return false
      // Un teléfono, un envío por corrida.
      if (vistos.has(p.telefono)) return false
      vistos.add(p.telefono)
      return true
    })
    .sort(
      (a, b) =>
        ORDEN_COBERTURA[a.cobertura] - ORDEN_COBERTURA[b.cobertura] ||
        (a.distancia_km ?? Number.POSITIVE_INFINITY) -
          (b.distancia_km ?? Number.POSITIVE_INFINITY) ||
        (b.resenas ?? 0) - (a.resenas ?? 0) ||
        a.nombre.localeCompare(b.nombre, 'es'),
    )
    .slice(0, cupo)
}
