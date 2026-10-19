import type { Etapa } from './etapa'
import type { FilaProspecto } from './repo'

export type ResumenProspectos = {
  total: number
  porEtapa: Record<Etapa, number>
  /** Celulares «sin contactar» y no claramente fuera de la zona: a quienes la prospección automática puede escribirles. */
  porEscribir: number
  /** Fijos «sin contactar»: a esos se les llama. */
  porLlamar: number
  sinTelefono: number
}

const ETAPAS: Etapa[] = [
  'nuevo',
  'contactado',
  'respondio',
  'cliente',
  'descartado',
  'no_contactar',
]

export function resumirProspectos(filas: readonly FilaProspecto[]): ResumenProspectos {
  const porEtapa = Object.fromEntries(ETAPAS.map((e) => [e, 0])) as Record<Etapa, number>
  for (const f of filas) porEtapa[f.etapa]++

  const nuevos = filas.filter((f) => f.etapa === 'nuevo')
  return {
    total: filas.length,
    porEtapa,
    porEscribir: nuevos.filter((f) => f.tipo_telefono === 'celular' && f.cobertura !== 'fuera')
      .length,
    porLlamar: nuevos.filter((f) => f.tipo_telefono === 'fijo').length,
    sinTelefono: nuevos.filter((f) => f.tipo_telefono === 'sin_telefono').length,
  }
}
