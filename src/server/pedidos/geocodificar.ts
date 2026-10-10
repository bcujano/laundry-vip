/**
 * Geocodificación de la dirección del cliente para medir la distancia a la planta.
 * Proveedor: Google Maps si hay `GOOGLE_MAPS_API_KEY`; si no, OpenStreetMap (Nominatim, sin llave,
 * menos preciso). Cualquier falla devuelve `null`: la cobertura cae a la lista de sectores.
 */
export type Punto = { lat: number; lng: number }

export type Geocodificacion = {
  punto: Punto
  /** true si es una calle o un número; false si es solo un barrio o una zona (menos fiable). */
  preciso: boolean
  /** true solo con Google: OpenStreetMap acierta barrios, pero a menudo falla con calles de Quito. */
  confiable: boolean
}

const TIEMPO_MAXIMO_MS = 4000

/** Cuadro aproximado de Quito y alrededores: un resultado fuera de él es un homónimo. */
const QUITO = { sur: -0.45, norte: 0.1, oeste: -78.75, este: -78.2 }

export function enQuito(p: Punto): boolean {
  return p.lat >= QUITO.sur && p.lat <= QUITO.norte && p.lng >= QUITO.oeste && p.lng <= QUITO.este
}

/** Distancia en línea recta (haversine), en kilómetros. */
export function distanciaKm(a: Punto, b: Punto): number {
  const rad = (grados: number) => (grados * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

type Buscar = typeof fetch

async function conGoogle(texto: string, llave: string, buscar: Buscar) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', `${texto}, Quito, Ecuador`)
  url.searchParams.set('components', 'country:EC')
  url.searchParams.set('language', 'es')
  url.searchParams.set('key', llave)
  const r = await buscar(url, { signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) })
  const cuerpo = (await r.json()) as {
    status?: string
    results?: { geometry: { location: { lat: number; lng: number }; location_type: string } }[]
  }
  const mejor = cuerpo.results?.[0]
  if (cuerpo.status !== 'OK' || !mejor) return null
  const { lat, lng } = mejor.geometry.location
  return {
    punto: { lat, lng },
    preciso: mejor.geometry.location_type !== 'APPROXIMATE',
    confiable: true,
  }
}

async function conNominatim(texto: string, buscar: Buscar) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', `${texto}, Quito, Ecuador`)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('countrycodes', 'ec')
  url.searchParams.set('limit', '1')
  const r = await buscar(url, {
    headers: { 'user-agent': 'laundry-vip-crm/1.0 (cobertura de recogida)' },
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  })
  const lista = (await r.json()) as { lat: string; lon: string; addresstype?: string }[]
  const mejor = lista[0]
  if (!mejor) return null
  const ZONAS = ['suburb', 'neighbourhood', 'quarter', 'city_district', 'city', 'state']
  return {
    punto: { lat: Number(mejor.lat), lng: Number(mejor.lon) },
    preciso: !ZONAS.includes(mejor.addresstype ?? ''),
    confiable: false,
  }
}

export async function geocodificar(
  texto: string,
  buscar: Buscar = fetch,
  llave: string | undefined = process.env.GOOGLE_MAPS_API_KEY,
): Promise<Geocodificacion | null> {
  const limpio = texto.trim()
  if (limpio.length < 3) return null
  try {
    const encontrado = llave
      ? await conGoogle(limpio, llave, buscar)
      : await conNominatim(limpio, buscar)
    if (!encontrado || !enQuito(encontrado.punto)) return null
    return encontrado
  } catch {
    return null
  }
}
