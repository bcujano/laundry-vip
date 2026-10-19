import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type ContextoDeEnvio,
  elegirProspectos,
  type ProspectoElegible,
} from '@/server/prospectos/elegir'
import { derivarEtapa } from '@/server/prospectos/etapa'
import {
  fraseDeSegmento,
  nombreParaMensaje,
  parametrosPrimerContacto,
} from '@/server/prospectos/mensaje'

/**
 * Las reglas de a quién se le escribe en frío. Son lo más delicado de la prospección: un error aquí
 * es un mensaje a quien dijo que no, a un cliente, a un fijo o a quien está fuera de la zona.
 */

const base: ProspectoElegible = {
  id: 'p1',
  nombre: 'Catering Uno',
  segmento: 'catering',
  telefono: '+593987001340',
  tipo_telefono: 'celular',
  cobertura: 'dentro',
  distancia_km: 1,
  resenas: 10,
  estado: 'nuevo',
}
const prospecto = (parcial: Partial<ProspectoElegible>): ProspectoElegible => ({
  ...base,
  ...parcial,
})

const libre: ContextoDeEnvio = {
  excluidos: new Set(),
  recientes: new Set(),
  yaEscritos: new Set(),
  enviadosHoy: 0,
  limiteDiario: 10,
}
const con = (parcial: Partial<ContextoDeEnvio>): ContextoDeEnvio => ({ ...libre, ...parcial })

describe('a quién se le escribe en frío', () => {
  it('a un celular nuevo y dentro de la zona, sí', () => {
    expect(elegirProspectos([base], libre)).toEqual([base])
  })

  it('a un fijo, nunca: a ese se le llama', () => {
    expect(elegirProspectos([prospecto({ tipo_telefono: 'fijo' })], libre)).toEqual([])
    expect(
      elegirProspectos([prospecto({ tipo_telefono: 'sin_telefono', telefono: null })], libre),
    ).toEqual([])
  })

  it('a quien está claramente fuera del radio, nunca; a quien no se pudo ubicar, sí', () => {
    expect(elegirProspectos([prospecto({ cobertura: 'fuera' })], libre)).toEqual([])
    expect(elegirProspectos([prospecto({ cobertura: 'sin_ubicar' })], libre)).toHaveLength(1)
    expect(elegirProspectos([prospecto({ cobertura: 'dudoso' })], libre)).toHaveLength(1)
  })

  it('a quien ya contactamos, descartamos o pidió que no le escriban, nunca', () => {
    for (const estado of ['contactado', 'descartado', 'no_contactar'] as const) {
      expect(elegirProspectos([prospecto({ estado })], libre)).toEqual([])
    }
  })

  it('al equipo, a los clientes, a los leads y a quien dijo «no seguir», nunca', () => {
    // Todos llegan en el mismo conjunto de teléfonos excluidos.
    expect(
      elegirProspectos([base], con({ excluidos: new Set([base.telefono as string]) })),
    ).toEqual([])
  })

  it('a quien recibió una plantilla en los últimos 25 días, no', () => {
    expect(
      elegirProspectos([base], con({ recientes: new Set([base.telefono as string]) })),
    ).toEqual([])
  })

  it('un negocio recibe el primer contacto una sola vez en la vida', () => {
    expect(elegirProspectos([base], con({ yaEscritos: new Set(['p1']) }))).toEqual([])
  })

  it('dos negocios con el mismo teléfono: solo uno por corrida', () => {
    const r = elegirProspectos([prospecto({ id: 'a' }), prospecto({ id: 'b' })], libre)
    expect(r).toHaveLength(1)
  })

  it('respeta el tope diario descontando lo que ya salió hoy', () => {
    const muchos = Array.from({ length: 8 }, (_, i) =>
      prospecto({ id: `p${i}`, telefono: `+59398700${1000 + i}` }),
    )
    expect(elegirProspectos(muchos, con({ limiteDiario: 5 }))).toHaveLength(5)
    expect(elegirProspectos(muchos, con({ limiteDiario: 5, enviadosHoy: 3 }))).toHaveLength(2)
    expect(elegirProspectos(muchos, con({ limiteDiario: 5, enviadosHoy: 5 }))).toEqual([])
    expect(elegirProspectos(muchos, con({ limiteDiario: 5, enviadosHoy: 9 }))).toEqual([])
  })

  it('primero los de dentro (los más cercanos), luego los dudosos y al final los sin ubicar', () => {
    const lista = [
      prospecto({
        id: 'sin',
        telefono: '+593980000001',
        cobertura: 'sin_ubicar',
        distancia_km: null,
        resenas: 999,
      }),
      prospecto({ id: 'lejos', telefono: '+593980000002', cobertura: 'dentro', distancia_km: 2.0 }),
      prospecto({
        id: 'dudoso',
        telefono: '+593980000003',
        cobertura: 'dudoso',
        distancia_km: 2.5,
      }),
      prospecto({ id: 'cerca', telefono: '+593980000004', cobertura: 'dentro', distancia_km: 0.4 }),
    ]
    expect(elegirProspectos(lista, libre).map((p) => p.id)).toEqual([
      'cerca',
      'lejos',
      'dudoso',
      'sin',
    ])
  })

  it('entre los sin ubicar, los de más reseñas primero (negocios más grandes)', () => {
    const lista = [
      prospecto({
        id: 'chico',
        telefono: '+593980000005',
        cobertura: 'sin_ubicar',
        distancia_km: null,
        resenas: 3,
      }),
      prospecto({
        id: 'grande',
        telefono: '+593980000006',
        cobertura: 'sin_ubicar',
        distancia_km: null,
        resenas: 400,
      }),
    ]
    expect(elegirProspectos(lista, libre).map((p) => p.id)).toEqual(['grande', 'chico'])
  })
})

describe('en qué etapa va un prospecto', () => {
  const nadie = { escribio: false, esCliente: false, noSeguir: false }

  it('sin señales, es lo que dice su estado guardado', () => {
    expect(derivarEtapa('nuevo', nadie)).toBe('nuevo')
    expect(derivarEtapa('contactado', nadie)).toBe('contactado')
    expect(derivarEtapa('descartado', nadie)).toBe('descartado')
  })

  it('si el teléfono ya le escribió al agente, «respondió» (aunque nunca le hayamos escrito)', () => {
    expect(derivarEtapa('contactado', { ...nadie, escribio: true })).toBe('respondio')
    expect(derivarEtapa('nuevo', { ...nadie, escribio: true })).toBe('respondio')
  })

  it('si ya tiene un pedido, es cliente', () => {
    expect(derivarEtapa('contactado', { escribio: true, esCliente: true, noSeguir: false })).toBe(
      'cliente',
    )
  })

  it('«no seguir» manda sobre todo lo demás, incluso sobre ser cliente', () => {
    expect(derivarEtapa('contactado', { escribio: true, esCliente: true, noSeguir: true })).toBe(
      'no_contactar',
    )
    expect(derivarEtapa('no_contactar', nadie)).toBe('no_contactar')
  })
})

describe('el primer mensaje', () => {
  it('cada tipo de negocio recibe lo que de verdad se le puede lavar', () => {
    expect(fraseDeSegmento('catering')).toContain('manteles')
    expect(fraseDeSegmento('hogares de ancianos')).toContain('ropa de cama')
    expect(fraseDeSegmento('tiendas de alquiler de ropa')).toContain('trajes')
  })

  it('un segmento que no conoce no inventa nada: frase general', () => {
    expect(fraseDeSegmento('submarinos')).toBe('ropa, manteles y cobijas')
  })

  it('las dos variables de la plantilla: el nombre y qué se les ofrece', () => {
    expect(parametrosPrimerContacto({ nombre: 'Zeraty Eventos', segmento: 'catering' })).toEqual([
      'Zeraty Eventos',
      'manteles, mandiles y ropa de trabajo',
    ])
  })

  it('Meta rechaza saltos de línea y espacios repetidos en una variable: se limpian', () => {
    expect(nombreParaMensaje('  Hogar\n  de   Ancianos\t Sol  ')).toBe('Hogar de Ancianos Sol')
  })

  it('un nombre larguísimo se corta en una palabra completa', () => {
    const largo = 'Centro de Convenciones y Eventos Metropolitano de la Ciudad de Quito Norte S.A.'
    const corto = nombreParaMensaje(largo)
    expect(corto.length).toBeLessThanOrEqual(60)
    expect(largo.startsWith(corto)).toBe(true)
    expect(largo[corto.length]).toBe(' ')
  })
})

// ── El interruptor: dos independientes, y apagados no sale nada ───────────────────────────────
const config = vi.hoisted(() => ({
  valor: {
    plantillas_automaticas: false,
    prospeccion_automatica: false,
    prospeccion_limite_diario: 7,
  },
}))
const aClientes = vi.hoisted(() => vi.fn())
const aProspectos = vi.hoisted(() => vi.fn())

vi.mock('@/server/configuracion/repo', () => ({ obtener: async () => config.valor }))
vi.mock('@/server/plantillas/candidatos', () => ({
  plantillasPendientes: aClientes,
  marcarPlantillaEnviada: vi.fn(),
}))
vi.mock('@/server/prospectos/candidatos', () => ({ prospectosPendientes: aProspectos }))
vi.mock('@/server/prospectos/repo', () => ({ marcarContactadoPorPlantilla: vi.fn() }))

describe('los interruptores de Configuración', () => {
  beforeEach(() => {
    aClientes
      .mockReset()
      .mockResolvedValue([
        { plantilla: 'reactivacion_30_dias', telefono: '+1', parametros: [], clave: '30' },
      ])
    aProspectos
      .mockReset()
      .mockResolvedValue([
        { plantilla: 'prospecto_primer_contacto', telefono: '+2', parametros: [], clave: 'p' },
      ])
  })

  async function pedir() {
    const { plantillasPendientesAccion } = await import('@/server/webhook/handlers/plantillas')
    const r = await plantillasPendientesAccion()
    return r.ok ? (r.data as { activo: boolean; envios: { plantilla: string }[] }) : null
  }

  it('con los dos apagados no sale nada y ni siquiera se consulta a quién', async () => {
    config.valor = {
      plantillas_automaticas: false,
      prospeccion_automatica: false,
      prospeccion_limite_diario: 7,
    }
    expect(await pedir()).toEqual({ activo: false, envios: [] })
    expect(aClientes).not.toHaveBeenCalled()
    expect(aProspectos).not.toHaveBeenCalled()
  })

  it('solo la prospección encendida: salen prospectos y el tope diario del dueño llega a la regla', async () => {
    config.valor = {
      plantillas_automaticas: false,
      prospeccion_automatica: true,
      prospeccion_limite_diario: 7,
    }
    const r = await pedir()
    expect(r?.envios.map((e) => e.plantilla)).toEqual(['prospecto_primer_contacto'])
    expect(aProspectos).toHaveBeenCalledWith(expect.any(Date), 7)
    expect(aClientes).not.toHaveBeenCalled()
  })

  it('solo los mensajes a clientes encendidos: NO se le escribe a ningún prospecto', async () => {
    config.valor = {
      plantillas_automaticas: true,
      prospeccion_automatica: false,
      prospeccion_limite_diario: 7,
    }
    const r = await pedir()
    expect(r?.envios.map((e) => e.plantilla)).toEqual(['reactivacion_30_dias'])
    expect(aProspectos).not.toHaveBeenCalled()
  })

  it('con los dos encendidos salen ambos', async () => {
    config.valor = {
      plantillas_automaticas: true,
      prospeccion_automatica: true,
      prospeccion_limite_diario: 7,
    }
    const r = await pedir()
    expect(r?.envios.map((e) => e.plantilla).sort()).toEqual([
      'prospecto_primer_contacto',
      'reactivacion_30_dias',
    ])
  })
})
