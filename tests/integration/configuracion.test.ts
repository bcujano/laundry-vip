import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { esE164 } from '@/lib/telefono'
import {
  actualizar,
  agregarOperador,
  eliminarOperador,
  esOperadorActivo,
  listarWhitelist,
  obtener,
  parametrosVentana,
} from '@/server/configuracion/repo'
import { obtenerProximaVentana } from '@/server/scheduling/ventana'

const TELEFONO_PRUEBA = '+593999000111'

afterAll(async () => {
  await supabaseAdmin().from('operador_whitelist').delete().eq('telefono', TELEFONO_PRUEBA)
})

describe('configuración del negocio', () => {
  // El dueño edita estos valores en el CRM: se prueba la forma, no un valor fijo.
  it('trae un horario y una tarifa válidos', async () => {
    const config = await obtener()
    expect(config.dias_operacion.length).toBeGreaterThan(0)
    for (const dia of config.dias_operacion) expect(dia).toBeGreaterThanOrEqual(1)
    expect(config.hora_recoleccion_inicio).toMatch(/^\d{2}:\d{2}/)
    expect(config.hora_recoleccion_fin > config.hora_recoleccion_inicio).toBe(true)
    expect(config.margen_minimo_minutos).toBeGreaterThanOrEqual(0)
    expect(Number(config.tarifa_combo)).toBeGreaterThanOrEqual(0)
  })

  it('los parámetros de la base alimentan el cálculo de ventanas', async () => {
    const parametros = await parametrosVentana()
    const ventana = obtenerProximaVentana(new Date(), parametros)
    expect(ventana.inicio.getTime()).toBeGreaterThan(Date.now())
  })

  it('un cambio de configuración persiste y se puede revertir', async () => {
    const antes = await obtener()
    expect((await actualizar({ nombre_negocio: 'Prueba temporal' })).ok).toBe(true)
    expect((await obtener()).nombre_negocio).toBe('Prueba temporal')

    await actualizar({ nombre_negocio: antes.nombre_negocio })
    expect((await obtener()).nombre_negocio).toBe(antes.nombre_negocio)
  })
})

describe('lista blanca de operadores', () => {
  it('guarda los teléfonos en E.164', async () => {
    const operadores = await listarWhitelist()
    expect(operadores.length).toBeGreaterThan(0)
    for (const operador of operadores) {
      expect(esE164(operador.telefono)).toBe(true)
    }
  })

  it('reconoce al operador de planta y rechaza a un desconocido', async () => {
    expect(await esOperadorActivo('+593963987124')).toBe(true)
    expect(await esOperadorActivo('+593000111222')).toBe(false)
  })

  it('agregar dos veces el mismo número no lo duplica', async () => {
    await agregarOperador(TELEFONO_PRUEBA, 'Prueba')
    await agregarOperador(TELEFONO_PRUEBA, 'Prueba renombrada')

    const coincidencias = (await listarWhitelist()).filter((o) => o.telefono === TELEFONO_PRUEBA)
    expect(coincidencias).toHaveLength(1)
    expect(coincidencias[0]?.nombre).toBe('Prueba renombrada')
  })

  it('quitar un operador lo saca de la lista y el agente deja de reconocerlo', async () => {
    await agregarOperador(TELEFONO_PRUEBA, 'Para quitar')
    const fila = (await listarWhitelist()).find((o) => o.telefono === TELEFONO_PRUEBA)
    if (!fila) throw new Error('No se agregó el operador de prueba')

    expect((await eliminarOperador(fila.id)).ok).toBe(true)
    expect((await listarWhitelist()).some((o) => o.telefono === TELEFONO_PRUEBA)).toBe(false)
    expect(await esOperadorActivo(TELEFONO_PRUEBA)).toBe(false)
  })

  it('la base rechaza un teléfono mal formado', async () => {
    const resultado = await agregarOperador('0963987124', 'Sin normalizar')
    expect(resultado.ok).toBe(false)
  })
})
