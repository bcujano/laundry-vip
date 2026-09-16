import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { listar, obtenerPorTelefono, POR_PAGINA } from '@/server/clientes/repo'

// Prefijo irrepetible para no chocar con datos de otra corrida ni con reales.
const CORRIDA = String(Date.now()).slice(-5)
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
    const pagina1 = await listar({ pagina: 1, busqueda: CORRIDA })
    expect(POR_PAGINA).toBe(50)
    expect(pagina1.clientes).toHaveLength(50)
    expect(pagina1.total).toBe(TOTAL)
    expect(pagina1.paginas).toBe(2)

    const pagina2 = await listar({ pagina: 2, busqueda: CORRIDA })
    expect(pagina2.clientes).toHaveLength(TOTAL - 50)
  })

  it('no repite clientes entre páginas', async () => {
    const pagina1 = await listar({ pagina: 1, busqueda: CORRIDA })
    const pagina2 = await listar({ pagina: 2, busqueda: CORRIDA })
    const ids = new Set([...pagina1.clientes, ...pagina2.clientes].map((c) => c.id))
    expect(ids.size).toBe(TOTAL)
  })

  it('filtra por tipo de negocio', async () => {
    const clinicas = await listar({ tipoNegocio: 'clinica', busqueda: CORRIDA })
    expect(clinicas.total).toBe(CLINICAS)
    expect(clinicas.clientes.every((c) => c.tipo_negocio === 'clinica')).toBe(true)

    const hoteles = await listar({ tipoNegocio: 'hotel', busqueda: CORRIDA })
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
