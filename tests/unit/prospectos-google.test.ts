import { describe, expect, it } from 'vitest'
import { probarLlaveGoogle, ubicarConGoogle } from '../../scripts/prospectos-ubicar.ts'

const respuesta = (cuerpo: unknown) =>
  (async () => Response.json(cuerpo)) as unknown as typeof fetch

describe('ubicar con Google Maps', () => {
  it('toma el punto y marca como preciso si no es aproximado', async () => {
    const buscar = respuesta({
      status: 'OK',
      results: [{ geometry: { location: { lat: -0.17, lng: -78.49 }, location_type: 'ROOFTOP' } }],
    })
    expect(await ubicarConGoogle('Av. América, Quito', 'llave', buscar)).toEqual({
      punto: { lat: -0.17, lng: -78.49 },
      preciso: true,
    })
  })

  it('un resultado aproximado no es preciso', async () => {
    const buscar = respuesta({
      status: 'OK',
      results: [
        { geometry: { location: { lat: -0.17, lng: -78.49 }, location_type: 'APPROXIMATE' } },
      ],
    })
    expect((await ubicarConGoogle('La Kennedy', 'llave', buscar))?.preciso).toBe(false)
  })

  it('descarta un resultado fuera de Quito (homónimo) y una llave rechazada', async () => {
    const lejos = respuesta({
      status: 'OK',
      results: [{ geometry: { location: { lat: 40.4, lng: -3.7 }, location_type: 'ROOFTOP' } }],
    })
    expect(await ubicarConGoogle('Calle Mayor', 'llave', lejos)).toBeNull()
    const rechazada = respuesta({ status: 'REQUEST_DENIED', error_message: 'referer' })
    expect(await ubicarConGoogle('Quito', 'llave', rechazada)).toBeNull()
  })

  it('la prueba de llave explica el motivo cuando Google la rechaza', async () => {
    const rechazada = respuesta({ status: 'REQUEST_DENIED', error_message: 'referer restrictions' })
    expect(await probarLlaveGoogle('llave', rechazada)).toBe('REQUEST_DENIED: referer restrictions')
    expect(await probarLlaveGoogle('llave', respuesta({ status: 'OK' }))).toBeNull()
  })
})
