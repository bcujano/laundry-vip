import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { prospectosPendientes } from '@/server/prospectos/candidatos'
import { PLANTILLA_PRIMER_CONTACTO } from '@/server/prospectos/mensaje'
import { cambiarEstado, listarProspectos } from '@/server/prospectos/repo'
import { marcarPlantillaAccion } from '@/server/webhook/handlers/plantillas'
import { corrida, prefijoTelefono } from '../util/corrida.ts'

/**
 * La prospección contra la base real, con negocios y teléfonos propios de la corrida (jamás los
 * prospectos importados del dueño ni su configuración). El interruptor de Configuración no se toca:
 * eso se prueba con el servidor simulado en tests/unit/prospectos-envio.test.ts.
 */
const ID = corrida()
const PREFIJO = prefijoTelefono(ID)
const FUENTE = `prueba-${ID}`
const db = supabaseAdmin()

const tel = (n: number) => `${PREFIJO}${String(n).padStart(2, '0')}`
const ids = new Map<string, string>()

async function crear(clave: string, parcial: Record<string, unknown>) {
  const { data, error } = await db
    .from('prospectos')
    .insert({
      nombre: `Negocio ${clave} ${ID}`,
      segmento: 'catering',
      tipo_telefono: 'celular',
      cobertura: 'dentro',
      distancia_km: 0.01,
      fuente: FUENTE,
      fuente_ref: clave,
      ...parcial,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  ids.set(clave, data.id)
}

beforeAll(async () => {
  await crear('bueno', { telefono: tel(1) })
  await crear('fuera', { telefono: tel(2), cobertura: 'fuera' })
  await crear('fijo', { telefono: tel(3), tipo_telefono: 'fijo' })
  await crear('escribio', { telefono: tel(4) })
  await crear('contactado', { telefono: tel(5), estado: 'contactado' })
  await crear('no-seguir', { telefono: tel(6) })
  await crear('equipo', { telefono: tel(7) })
  await crear('sin-telefono', { telefono: null, tipo_telefono: 'sin_telefono' })

  // «escribio» ya le escribió al agente; «no-seguir» pidió que no le escriban.
  const conversaciones = await db.from('conversaciones').insert([
    { telefono: tel(4), contexto: {}, no_seguir: false },
    { telefono: tel(6), contexto: {}, no_seguir: true },
  ])
  const equipo = await db
    .from('operador_whitelist')
    .insert({ telefono: tel(7), nombre: `Equipo ${ID}`, nivel: 'operador' })
  // Si la preparación falla en silencio, la prueba mentiría: que grite.
  for (const r of [conversaciones, equipo]) if (r.error) throw new Error(r.error.message)
})

afterAll(async () => {
  await db.from('plantillas_enviadas').delete().like('telefono', `${PREFIJO}%`)
  await db.from('conversaciones').delete().like('telefono', `${PREFIJO}%`)
  await db.from('operador_whitelist').delete().like('telefono', `${PREFIJO}%`)
  await db.from('prospectos').delete().eq('fuente', FUENTE)
})

const pendientesDeLaCorrida = async () =>
  (await prospectosPendientes(new Date(), 50)).filter((e) => e.telefono.startsWith(PREFIJO))

describe('a quién se le escribe, con datos reales', () => {
  it('solo al celular nuevo y dentro de la zona; no a los otros siete', async () => {
    const envios = await pendientesDeLaCorrida()

    expect(envios.map((e) => e.telefono)).toEqual([tel(1)])
    expect(envios[0]).toMatchObject({
      plantilla: PLANTILLA_PRIMER_CONTACTO,
      clave: ids.get('bueno'),
    })
    // Las dos variables de la plantilla: el nombre del negocio y qué se le ofrece.
    expect(envios[0]?.parametros).toEqual([
      `Negocio bueno ${ID}`,
      'manteles, mandiles y ropa de trabajo',
    ])
  })

  it('cuando Meta lo acepta, queda contactado y no se le vuelve a escribir', async () => {
    const id = ids.get('bueno') as string
    const r = await marcarPlantillaAccion({
      telefono: tel(1),
      plantilla: PLANTILLA_PRIMER_CONTACTO,
      clave: id,
    })
    expect(r.ok).toBe(true)

    const { data } = await db
      .from('prospectos')
      .select('estado, canal_primer_contacto, primer_contacto_en')
      .eq('id', id)
      .single()
    expect(data).toMatchObject({
      estado: 'contactado',
      canal_primer_contacto: 'plantilla_whatsapp',
    })
    expect(data?.primer_contacto_en).not.toBeNull()

    expect(await pendientesDeLaCorrida()).toEqual([])
  })

  it('marcar dos veces lo mismo no rompe ni duplica', async () => {
    const id = ids.get('bueno') as string
    const otra = await marcarPlantillaAccion({
      telefono: tel(1),
      plantilla: PLANTILLA_PRIMER_CONTACTO,
      clave: id,
    })
    expect(otra.ok).toBe(true)
    const { count } = await db
      .from('plantillas_enviadas')
      .select('id', { count: 'exact', head: true })
      .eq('telefono', tel(1))
    expect(count).toBe(1)
  })
})

describe('en qué etapa aparece cada uno en el CRM', () => {
  it('lo deduce de lo que ya registró el agente, sin que nadie lo actualice', async () => {
    const etapa = new Map(
      (await listarProspectos())
        .filter((p) => p.fuente === FUENTE)
        .map((p) => [p.fuente_ref, p.etapa]),
    )

    expect(etapa.get('bueno')).toBe('contactado')
    expect(etapa.get('escribio')).toBe('respondio')
    expect(etapa.get('no-seguir')).toBe('no_contactar')
    expect(etapa.get('contactado')).toBe('contactado')
    expect(etapa.get('fuera')).toBe('nuevo')
  })

  it('lo que hace el equipo a mano (llamar, descartar) queda guardado', async () => {
    const id = ids.get('fijo') as string
    expect((await cambiarEstado(id, 'contactado', 'llamada')).ok).toBe(true)
    const { data } = await db
      .from('prospectos')
      .select('estado, canal_primer_contacto')
      .eq('id', id)
      .single()
    expect(data).toMatchObject({ estado: 'contactado', canal_primer_contacto: 'llamada' })

    expect((await cambiarEstado(id, 'descartado')).ok).toBe(true)
    const { data: despues } = await db.from('prospectos').select('estado').eq('id', id).single()
    expect(despues?.estado).toBe('descartado')
  })
})

describe('la base protege lo que el código no debe permitir', () => {
  it('un teléfono es de un solo prospecto', async () => {
    const { error } = await db.from('prospectos').insert({
      nombre: `Repetido ${ID}`,
      segmento: 'catering',
      tipo_telefono: 'celular',
      telefono: tel(1),
      fuente: FUENTE,
      fuente_ref: 'repetido',
    })
    expect(error?.message).toMatch(/prospectos_telefono_idx|duplicate key/i)
  })

  it('importar dos veces la misma fila de la misma hoja no duplica', async () => {
    const { error } = await db.from('prospectos').insert({
      nombre: `Otra vez ${ID}`,
      segmento: 'catering',
      tipo_telefono: 'sin_telefono',
      fuente: FUENTE,
      fuente_ref: 'bueno',
    })
    expect(error?.message).toMatch(/duplicate key/i)
  })

  it('un teléfono mal formado no entra', async () => {
    const { error } = await db.from('prospectos').insert({
      nombre: `Mal ${ID}`,
      segmento: 'catering',
      tipo_telefono: 'celular',
      telefono: '0987001340',
      fuente: FUENTE,
      fuente_ref: 'mal-telefono',
    })
    expect(error).not.toBeNull()
  })
})
