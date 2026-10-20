/**
 * Dónde cae un prospecto respecto del radio de recolección del local. Es una copia deliberada y mínima
 * de `src/server/pedidos/geocodificar.ts` (los scripts no pueden importar el alias `@/`): la prueba
 * `tests/unit/prospectos.test.ts` compara las dos distancias para que no se separen.
 *
 * Se usa solo para ORDENAR y para NO escribirle a quien está claramente fuera: el agente igual
 * verifica la cobertura por dentro cuando el prospecto responde y da una dirección.
 */

export type Punto = { lat: number; lng: number }
export type CoberturaProspecto = 'dentro' | 'fuera' | 'dudoso' | 'sin_ubicar'

/** Distancia en línea recta (haversine), en kilómetros. */
export function distanciaKm(a: Punto, b: Punto): number {
  const rad = (grados: number) => (grados * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

/**
 * Cuánto se acepta errar: OpenStreetMap ubica un barrio, no la puerta del negocio. Una zona (barrio)
 * pide margen amplio; una calle o número, uno corto. Entre el margen y el radio queda «dudoso».
 */
export const MARGEN_ZONA_KM = 0.7
export const MARGEN_CALLE_KM = 0.3

export function clasificarDistancia(
  km: number | null,
  radioKm: number,
  preciso: boolean,
): CoberturaProspecto {
  if (km === null) return 'sin_ubicar'
  const margen = preciso ? MARGEN_CALLE_KM : MARGEN_ZONA_KM
  if (km <= radioKm - margen) return 'dentro'
  if (km > radioKm + margen) return 'fuera'
  return 'dudoso'
}

/** Cuadro aproximado de Quito y alrededores: un resultado fuera de él es un homónimo. */
const QUITO = { sur: -0.45, norte: 0.1, oeste: -78.75, este: -78.2 }
const ZONAS = ['suburb', 'neighbourhood', 'quarter', 'city_district', 'city', 'state']

export type Ubicado = { punto: Punto; preciso: boolean }

/** Lo que va antes de «Quito, Ecuador» y no es un código postal ni un plus code («VG4F+WXJ»). */
export function consultasDeDireccion(direccion: string): string[] {
  const partes = direccion
    .replace(/\b17\d{4}\b/g, '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '' && !/quito|ecuador/i.test(p) && !/^[A-Z0-9]{4}\+[A-Z0-9]{2,3}$/.test(p))
  const completa = partes.join(', ')
  const ultimas = partes.slice(-2).join(', ')
  return [...new Set([completa, ultimas, partes.at(-1) ?? ''])].filter((c) => c.length >= 3)
}

export async function ubicar(
  direccion: string,
  buscar: typeof fetch = fetch,
): Promise<Ubicado | null> {
  for (const consulta of consultasDeDireccion(direccion)) {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', `${consulta}, Quito, Ecuador`)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('countrycodes', 'ec')
    url.searchParams.set('limit', '1')
    try {
      const respuesta = await buscar(url, {
        headers: { 'user-agent': 'laundry-vip-crm/1.0 (prospeccion; contacto del dueno)' },
        signal: AbortSignal.timeout(6000),
      })
      const lista = (await respuesta.json()) as { lat: string; lon: string; addresstype?: string }[]
      const mejor = lista[0]
      if (!mejor) continue
      const punto = { lat: Number(mejor.lat), lng: Number(mejor.lon) }
      const enQuito =
        punto.lat >= QUITO.sur &&
        punto.lat <= QUITO.norte &&
        punto.lng >= QUITO.oeste &&
        punto.lng <= QUITO.este
      if (!enQuito) continue
      return { punto, preciso: !ZONAS.includes(mejor.addresstype ?? '') }
    } catch {
      // Un timeout o un 429 de OpenStreetMap no frena la importación: queda «sin ubicar».
    }
  }
  return null
}

/** Google Maps entiende la dirección completa de Maps tal cual; se usa si la llave sirve. */
export async function ubicarConGoogle(
  direccion: string,
  llave: string,
  buscar: typeof fetch = fetch,
): Promise<Ubicado | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set(
    'address',
    direccion.includes('Quito') ? direccion : `${direccion}, Quito, Ecuador`,
  )
  url.searchParams.set('components', 'country:EC')
  url.searchParams.set('language', 'es')
  url.searchParams.set('key', llave)
  try {
    const respuesta = await buscar(url, { signal: AbortSignal.timeout(6000) })
    const cuerpo = (await respuesta.json()) as {
      status?: string
      results?: { geometry: { location: Punto; location_type: string } }[]
    }
    const mejor = cuerpo.results?.[0]
    if (cuerpo.status !== 'OK' || !mejor) return null
    const punto = mejor.geometry.location
    if (
      punto.lat < QUITO.sur ||
      punto.lat > QUITO.norte ||
      punto.lng < QUITO.oeste ||
      punto.lng > QUITO.este
    )
      return null
    return { punto, preciso: mejor.geometry.location_type !== 'APPROXIMATE' }
  } catch {
    return null
  }
}

/** ¿La llave de Google sirve para geocodificar? Devuelve el motivo si no (p. ej. REQUEST_DENIED). */
export async function probarLlaveGoogle(llave: string, buscar: typeof fetch = fetch) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', 'Quito, Ecuador')
  url.searchParams.set('key', llave)
  const cuerpo = (await (await buscar(url, { signal: AbortSignal.timeout(6000) })).json()) as {
    status?: string
    error_message?: string
  }
  return cuerpo.status === 'OK' ? null : `${cuerpo.status}: ${cuerpo.error_message ?? ''}`.trim()
}
