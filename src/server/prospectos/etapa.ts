import type { EstadoProspecto } from '@/types/database'

/**
 * En qué punto va un prospecto. Lo guardado en la base es solo lo que hace el equipo o el envío
 * automático (nuevo, contactado, descartado, no contactar); «respondió» y «cliente» se DEDUCEN de lo
 * que el agente ya registra (conversaciones y pedidos). Así el camino caliente del webhook no cambia y
 * el estado nunca se desfasa de la realidad.
 */
export type Etapa = 'cliente' | 'respondio' | 'contactado' | 'nuevo' | 'descartado' | 'no_contactar'

export type SenalesDelTelefono = {
  /** Existe una conversación con ese teléfono: ya le escribió al agente. */
  escribio: boolean
  /** Tiene al menos un pedido. */
  esCliente: boolean
  /** Pidió que no le escriban más (la herramienta `no_seguir` del agente). */
  noSeguir: boolean
}

export function derivarEtapa(estado: EstadoProspecto, senales: SenalesDelTelefono): Etapa {
  if (senales.noSeguir || estado === 'no_contactar') return 'no_contactar'
  if (senales.esCliente) return 'cliente'
  if (senales.escribio) return 'respondio'
  if (estado === 'descartado') return 'descartado'
  if (estado === 'contactado') return 'contactado'
  return 'nuevo'
}

export const ETIQUETA_ETAPA: Record<Etapa, string> = {
  cliente: 'Ya es cliente',
  respondio: 'Respondió',
  contactado: 'Contactado',
  nuevo: 'Sin contactar',
  descartado: 'Descartado',
  no_contactar: 'No contactar',
}
