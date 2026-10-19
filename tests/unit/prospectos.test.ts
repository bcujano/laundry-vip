import { describe, expect, it } from 'vitest'
import { distanciaKm as distanciaDelServidor } from '@/server/pedidos/geocodificar'
import {
  clasificarTelefono,
  type FilaHoja,
  prepararProspectos,
  SEGMENTOS_DE_TRABAJO,
} from '../../scripts/prospectos-datos.ts'
import {
  clasificarDistancia,
  consultasDeDireccion,
  distanciaKm as distanciaDelScript,
} from '../../scripts/prospectos-ubicar.ts'

/**
 * Los formatos de teléfono salen de la hoja real de ProspectorVIP (81 negocios de los 7 segmentos
 * que el dueño marcó): «098 700 1340», «(02) 397-0900», «326-0592» y «299-3300 ext. 1019».
 */

describe('clasificar el teléfono de la hoja', () => {
  it('un celular («098 700 1340») queda en E.164 y se puede escribir por WhatsApp', () => {
    expect(clasificarTelefono('098 700 1340')).toMatchObject({
      telefono: '+593987001340',
      tipo: 'celular',
    })
  })

  it('un fijo con código de área («(02) 397-0900») es fijo: a ese se le llama', () => {
    expect(clasificarTelefono('(02) 397-0900')).toMatchObject({
      telefono: '+59323970900',
      tipo: 'fijo',
      nota: null,
    })
  })

  it('un fijo local sin código («326-0592») se asume de Quito y lo dice', () => {
    const r = clasificarTelefono('326-0592')
    expect(r).toMatchObject({ telefono: '+59323260592', tipo: 'fijo' })
    expect(r.nota).toContain('02')
  })

  it('una extensión no entra al número y se conserva aparte', () => {
    const r = clasificarTelefono('299-3300 ext. 1019')
    expect(r.telefono).toBe('+59322993300')
    expect(r.extension).toBe('1019')
  })

  it('con +593 ya puesto no lo duplica', () => {
    expect(clasificarTelefono('+593 98 700 1340').telefono).toBe('+593987001340')
  })

  it('sin teléfono, o con algo que no es un teléfono, no inventa un número', () => {
    expect(clasificarTelefono('')).toMatchObject({ telefono: null, tipo: 'sin_telefono' })
    expect(clasificarTelefono(null)).toMatchObject({ telefono: null, tipo: 'sin_telefono' })
    const raro = clasificarTelefono('llamar a recepción')
    expect(raro.telefono).toBeNull()
    expect(raro.nota).toContain('no se reconoce')
  })
})

const fila = (parcial: Partial<FilaHoja>): FilaHoja => ({
  numero: 1,
  nombre: 'Negocio de prueba',
  direccion: 'Calle 1, Quito',
  telefono: '098 700 1340',
  emails: null,
  website: null,
  instagram: null,
  rating: 4.5,
  reviews: 10,
  segmentos: 'catering',
  google_maps: null,
  ...parcial,
})

const OPCIONES = { segmentos: SEGMENTOS_DE_TRABAJO, fuente: 'prueba' }

describe('preparar los prospectos', () => {
  it('trabaja solo con los segmentos marcados, sin importar mayúsculas ni espacios', () => {
    const { prospectos } = prepararProspectos(
      [
        fila({ numero: 1, segmentos: 'catering' }),
        fila({
          numero: 2,
          nombre: 'B',
          telefono: '099 111 2222',
          segmentos: ' Hogares  de ancianos ',
        }),
        fila({ numero: 3, nombre: 'C', telefono: '099 333 4444', segmentos: 'restaurantes' }),
        fila({
          numero: 4,
          nombre: 'D',
          telefono: '099 555 6666',
          segmentos: 'clínicas; hospitales',
        }),
      ],
      OPCIONES,
    )
    expect(prospectos.map((p) => p.nombre)).toEqual(['Negocio de prueba', 'B'])
    expect(prospectos[1]?.segmento).toBe('hogares de ancianos')
  })

  it('un segmento compuesto solo cuenta si es EXACTAMENTE uno de los marcados', () => {
    // «centros de convenciones; salones de eventos» está marcado; «clínicas; hospitales» no.
    const { prospectos } = prepararProspectos(
      [fila({ segmentos: 'centros de convenciones; salones de eventos' })],
      OPCIONES,
    )
    expect(prospectos).toHaveLength(1)
  })

  it('no usa la columna WhatsApp: el teléfono es el de la columna Teléfono', () => {
    const conWhatsApp = { ...fila({}), whatsapp: '+593999690335' }
    const { prospectos } = prepararProspectos([conWhatsApp as FilaHoja], OPCIONES)
    expect(prospectos[0]?.telefono).toBe('+593987001340')
    expect(JSON.stringify(prospectos)).not.toContain('999690335')
  })

  it('dos negocios con el mismo teléfono: el segundo se descarta y se dice por qué', () => {
    const { prospectos, descartados } = prepararProspectos(
      [fila({ numero: 1, nombre: 'Primero' }), fila({ numero: 2, nombre: 'Segundo' })],
      OPCIONES,
    )
    expect(prospectos.map((p) => p.nombre)).toEqual(['Primero'])
    expect(descartados).toEqual([{ nombre: 'Segundo', motivo: 'comparte teléfono con «Primero»' }])
  })

  it('los negocios sin teléfono entran igual (se les llega por otro canal) y no chocan entre sí', () => {
    const { prospectos } = prepararProspectos(
      [fila({ numero: 1, telefono: null }), fila({ numero: 2, nombre: 'Otro', telefono: null })],
      OPCIONES,
    )
    expect(prospectos).toHaveLength(2)
    expect(prospectos.every((p) => p.tipo_telefono === 'sin_telefono')).toBe(true)
  })

  it('guarda la extensión en las notas y toma el primer correo', () => {
    const { prospectos } = prepararProspectos(
      [fila({ telefono: '299-3300 ext. 1019', emails: 'a@x.com; b@x.com' })],
      OPCIONES,
    )
    expect(prospectos[0]?.notas).toContain('Extensión 1019')
    expect(prospectos[0]?.email).toBe('a@x.com')
  })

  it('la referencia de la fuente es el número de la hoja, para poder importar dos veces sin duplicar', () => {
    const { prospectos } = prepararProspectos([fila({ numero: 190 })], OPCIONES)
    expect(prospectos[0]).toMatchObject({ fuente: 'prueba', fuente_ref: '190' })
  })
})

describe('dónde cae el prospecto respecto del radio', () => {
  it('la distancia del script es la misma que la del servidor', () => {
    const planta = { lat: -0.138297, lng: -78.482037 }
    const punto = { lat: -0.1612, lng: -78.4701 }
    expect(distanciaDelScript(planta, punto)).toBeCloseTo(distanciaDelServidor(planta, punto), 9)
  })

  it('dentro, fuera o dudoso según el radio y el margen', () => {
    expect(clasificarDistancia(1.0, 2.5, true)).toBe('dentro')
    expect(clasificarDistancia(2.4, 2.5, true)).toBe('dudoso')
    expect(clasificarDistancia(4.0, 2.5, true)).toBe('fuera')
    expect(clasificarDistancia(null, 2.5, true)).toBe('sin_ubicar')
  })

  it('un barrio (zona) pide más margen que una calle', () => {
    expect(clasificarDistancia(2.0, 2.5, true)).toBe('dentro')
    expect(clasificarDistancia(2.0, 2.5, false)).toBe('dudoso')
  })

  it('las consultas quitan el código postal y el plus code, y terminan en el barrio', () => {
    const q = consultasDeDireccion('VG4F+WXJ, El Morlán, 170138 Quito, Ecuador')
    expect(q).toEqual(['El Morlán'])
    expect(consultasDeDireccion('Av. Brasil 48-118, La Concepción, 170104 Quito, Ecuador')).toEqual(
      ['Av. Brasil 48-118, La Concepción', 'La Concepción'],
    )
  })
})
