import { verificarSector } from './cobertura'
import { distanciaKm, type Geocodificacion, type Punto } from './geocodificar'

/**
 * Cobertura por distancia en línea recta a la planta (radio de Configuración, hoy 2,5 km),
 * con la lista de sectores de respaldo. Reglas, en orden:
 *
 *  1. Con dirección y un geocodificado preciso (calle o número), manda la distancia — pero si el
 *     geocodificador no es fiable (OpenStreetMap) y el sector está en la lista, manda la lista.
 *  2. Sin eso, un sector de la lista del dueño cuenta como dentro.
 *  3. Si el sector se geocodifica (zona), solo se decide si está claramente dentro o fuera del
 *     radio (con un margen, porque el centro de un barrio no es la casa del cliente).
 *  4. Si nada decide, la lista: dentro/fuera, o `null` (no se puede verificar) si está vacía.
 */
export type EntradaCobertura = { sector?: string; direccion?: string }

export type ConfigCobertura = {
  radio_cobertura_km: number
  sectores_cobertura: string[]
  local_latitud: number
  local_longitud: number
}

export type Geocodificador = (texto: string) => Promise<Geocodificacion | null>

export type VeredictoCobertura =
  | { estado: 'falta_sector' }
  | {
      estado: 'dentro' | 'fuera' | 'sin_verificar'
      km: number | null
      metodo: 'distancia' | 'lista'
    }

/** Margen para un geocodificado de zona: el centro del barrio puede errar en cientos de metros. */
const MARGEN_ZONA_KM = 0.7

export async function evaluarCobertura(
  entrada: EntradaCobertura,
  config: ConfigCobertura,
  geocodificar: Geocodificador,
): Promise<VeredictoCobertura> {
  const sector = entrada.sector?.trim() ?? ''
  const direccion = entrada.direccion?.trim() ?? ''
  if (sector.length < 3 && direccion.length < 3) return { estado: 'falta_sector' }

  const planta: Punto = { lat: Number(config.local_latitud), lng: Number(config.local_longitud) }
  const radio = Number(config.radio_cobertura_km)
  const km = (g: Geocodificacion) => distanciaKm(planta, g.punto)

  const lista = verificarSector(sector, config.sectores_cobertura)

  if (direccion.length >= 3) {
    const g = await geocodificar([direccion, sector].filter(Boolean).join(', '))
    if (g?.preciso && (g.confiable || lista !== 'dentro')) {
      const d = km(g)
      return { estado: d <= radio ? 'dentro' : 'fuera', km: d, metodo: 'distancia' }
    }
  }

  if (lista === 'dentro') return { estado: 'dentro', km: null, metodo: 'lista' }

  if (sector.length >= 3) {
    const g = await geocodificar(sector)
    if (g) {
      const d = km(g)
      if (d <= radio - MARGEN_ZONA_KM) return { estado: 'dentro', km: d, metodo: 'distancia' }
      if (d > radio + MARGEN_ZONA_KM) return { estado: 'fuera', km: d, metodo: 'distancia' }
    }
  }

  if (lista === 'falta_sector') return { estado: 'falta_sector' }
  return { estado: lista === 'fuera' ? 'fuera' : 'sin_verificar', km: null, metodo: 'lista' }
}
