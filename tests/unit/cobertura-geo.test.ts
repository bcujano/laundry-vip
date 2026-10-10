import { describe, expect, it } from 'vitest'
import { evaluarCobertura } from '@/server/pedidos/cobertura-geo'
import { distanciaKm, geocodificar } from '@/server/pedidos/geocodificar'

const PLANTA = { lat: -0.138297, lng: -78.482037 }
const CONFIG = {
  radio_cobertura_km: 2.5,
  sectores_cobertura: ['La Kennedy', 'Jipijapa'],
  local_latitud: PLANTA.lat,
  local_longitud: PLANTA.lng,
}

/** Un punto a `km` kilómetros al norte de la planta (1° de latitud ≈ 111,19 km). */
const alNorte = (km: number) => ({ lat: PLANTA.lat + km / 111.19, lng: PLANTA.lng })
const geo =
  (km: number, preciso: boolean, confiable = true) =>
  async () => ({
    punto: alNorte(km),
    preciso,
    confiable,
  })
const sinGeo = async () => null

describe('distancia en línea recta', () => {
  it('mide kilómetros reales', () => {
    expect(distanciaKm(PLANTA, PLANTA)).toBeCloseTo(0, 5)
    expect(distanciaKm(PLANTA, alNorte(2.5))).toBeCloseTo(2.5, 1)
  })
})

describe('cobertura por distancia con la lista de sectores de respaldo', () => {
  it('con una dirección precisa manda la distancia, aunque el barrio esté en la lista', async () => {
    const cerca = await evaluarCobertura(
      { sector: 'La Kennedy', direccion: 'Av. de los Pinos 123' },
      CONFIG,
      geo(1.2, true),
    )
    expect(cerca).toMatchObject({ estado: 'dentro', metodo: 'distancia' })

    const lejos = await evaluarCobertura(
      { sector: 'La Kennedy', direccion: 'Calle lejana 45' },
      CONFIG,
      geo(3.4, true),
    )
    expect(lejos).toMatchObject({ estado: 'fuera', metodo: 'distancia' })
  })

  it('un geocodificador poco fiable (OpenStreetMap) no vence a un sector de la lista', async () => {
    const r = await evaluarCobertura(
      { sector: 'La Kennedy', direccion: 'Av. de los Pinos y Pedro Barrios' },
      CONFIG,
      geo(7, true, false),
    )
    expect(r).toMatchObject({ estado: 'dentro', metodo: 'lista' })
  })

  it('solo con el sector, uno de la lista cuenta como dentro', async () => {
    const r = await evaluarCobertura({ sector: 'Jipijapa' }, CONFIG, geo(9, false))
    expect(r).toMatchObject({ estado: 'dentro', metodo: 'lista' })
  })

  it('un sector fuera de la lista se decide por la distancia si está claramente lejos o cerca', async () => {
    expect(await evaluarCobertura({ sector: 'Cumbayá' }, CONFIG, geo(12, false))).toMatchObject({
      estado: 'fuera',
    })
    expect(
      await evaluarCobertura({ sector: 'Barrio vecino' }, CONFIG, geo(0.9, false)),
    ).toMatchObject({
      estado: 'dentro',
    })
  })

  it('en el borde del radio no se arriesga: manda la lista', async () => {
    const r = await evaluarCobertura({ sector: 'Barrio del borde' }, CONFIG, geo(2.6, false))
    expect(r).toMatchObject({ estado: 'fuera', metodo: 'lista' })
  })

  it('si no se puede geocodificar, cae a la lista (o a «sin verificar» si está vacía)', async () => {
    expect(await evaluarCobertura({ sector: 'Cumbayá' }, CONFIG, sinGeo)).toMatchObject({
      estado: 'fuera',
      metodo: 'lista',
    })
    expect(
      await evaluarCobertura({ sector: 'Cumbayá' }, { ...CONFIG, sectores_cobertura: [] }, sinGeo),
    ).toMatchObject({ estado: 'sin_verificar' })
  })

  it('sin sector ni dirección no se puede decidir', async () => {
    expect(await evaluarCobertura({}, CONFIG, sinGeo)).toEqual({ estado: 'falta_sector' })
  })
})

describe('geocodificar', () => {
  const respuesta = (cuerpo: unknown) =>
    (async () => ({ json: async () => cuerpo }) as Response) as typeof fetch

  it('Google: resultado preciso dentro de Quito', async () => {
    const r = await geocodificar(
      'Av. de los Pinos',
      respuesta({
        status: 'OK',
        results: [
          { geometry: { location: { lat: -0.139, lng: -78.481 }, location_type: 'ROOFTOP' } },
        ],
      }),
      'llave-de-prueba',
    )
    expect(r?.preciso).toBe(true)
  })

  it('descarta un homónimo fuera de Quito y cualquier falla de red', async () => {
    const lejos = respuesta({
      status: 'OK',
      results: [{ geometry: { location: { lat: -2.9, lng: -79.0 }, location_type: 'ROOFTOP' } }],
    })
    expect(await geocodificar('Calle Bolívar', lejos, 'llave')).toBeNull()
    const caida = (async () => {
      throw new Error('sin red')
    }) as unknown as typeof fetch
    expect(await geocodificar('Calle Bolívar', caida, 'llave')).toBeNull()
  })

  it('OpenStreetMap (sin llave): un barrio no es preciso', async () => {
    const r = await geocodificar(
      'La Kennedy',
      respuesta([{ lat: '-0.14', lon: '-78.48', addresstype: 'suburb' }]),
      undefined,
    )
    expect(r).toEqual({ punto: { lat: -0.14, lng: -78.48 }, preciso: false, confiable: false })
  })
})
