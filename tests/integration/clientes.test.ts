import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { listar, obtenerPorTelefono, POR_PAGINA } from '@/server/clientes/repo'
import { corrida } from '../util/corrida.ts'

// Prefijo irrepetible para no chocar con datos de otra corrida ni con reales.
const CORRIDA = corrida()
// La búsqueda va por una frase que ningún cliente real puede tener: con solo los dígitos de la corrida,
// el teléfono de un cliente verdadero que los contuviera ya contaba como uno más (pasó el 2026-10-05).
const BUSQUEDA = `Prueba ${CORRIDA}`
const PREFIJO = `+5939${CORRIDA}`
const TOTAL = 55
const CLINICAS = 20

beforeAll(async () => {
  const filas = Array.from({ length: TOTAL }, (_, i) => ({
    telefono: `${PREFIJO}${String(i).padStart(3, '0')}`,
    nombre_negocio:
      i < CLINICAS ? `Clínica Prueba ${CORRIDA}-${i}` : `Negocio Prueba ${CORRIDA}-${i}`,
    nombre_contacto: `Contacto ${i}`,
    tipo_negocio: i < CLINICAS ? 'clinica' : 'restaurante',
    canal_origen: 'whatsapp_agente',
  }))

  const { error } = await supabaseAdmin().from('clientes').insert(filas)
  if (error) throw new Error(`No se pudo preparar la prueba: ${error.message}`)
})

afterAll(async () => {
  await supabaseAdmin().from('clientes').delete().like('telefono', `${PREFIJO}%`)
})

describe('lista de clientes', () => {
  it('pagina de a 50', async () => {
    const pagina1 = await listar({ pagina: 1, busqueda: BUSQUEDA })
    expect(POR_PAGINA).toBe(50)
    expect(pagina1.clientes).toHaveLength(50)
    expect(pagina1.total).toBe(TOTAL)
    expect(pagina1.paginas).toBe(2)

    const pagina2 = await listar({ pagina: 2, busqueda: BUSQUEDA })
    expect(pagina2.clientes).toHaveLength(TOTAL - 50)
  })

  it('no repite clientes entre páginas', async () => {
    const pagina1 = await listar({ pagina: 1, busqueda: BUSQUEDA })
    const pagina2 = await listar({ pagina: 2, busqueda: BUSQUEDA })
    const ids = new Set([...pagina1.clientes, ...pagina2.clientes].map((c) => c.id))
    expect(ids.size).toBe(TOTAL)
  })

  it('filtra por tipo de negocio', async () => {
    const clinicas = await listar({ tipoNegocio: 'clinica', busqueda: BUSQUEDA })
    expect(clinicas.total).toBe(CLINICAS)
    expect(clinicas.clientes.every((c) => c.tipo_negocio === 'clinica')).toBe(true)

    const hoteles = await listar({ tipoNegocio: 'hotel', busqueda: BUSQUEDA })
    expect(hoteles.total).toBe(0)
    expect(hoteles.paginas).toBe(1)
  })

  it('busca por nombre parcial sin distinguir mayúsculas', async () => {
    const enMinusculas = await listar({ busqueda: `clínica prueba ${CORRIDA}` })
    const enMayusculas = await listar({ busqueda: `CLÍNICA PRUEBA ${CORRIDA}` })

    expect(enMinusculas.total).toBe(CLINICAS)
    expect(enMayusculas.total).toBe(CLINICAS)
  })

  it('encuentra un cliente por su teléfono E.164', async () => {
    const cliente = await obtenerPorTelefono(`${PREFIJO}000`)
    expect(cliente?.tipo_negocio).toBe('clinica')
    expect(await obtenerPorTelefono('+593000000000')).toBeNull()
  })
})
