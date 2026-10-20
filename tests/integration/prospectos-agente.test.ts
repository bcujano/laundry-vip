import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { consultaAdmin } from '@/server/webhook/handlers/admin'
import { verificarWhitelistOperador } from '@/server/webhook/handlers/cliente'
import { noSeguir } from '@/server/webhook/handlers/no-seguir'
import { corrida, prefijoTelefono } from '../util/corrida.ts'

/**
 * Lo que el agente ve y hace cuando le escribe un negocio de la lista de prospección, contra la base
 * real y con teléfonos propios de la corrida (nunca un prospecto importado del dueño).
 */
const ID = corrida()
const PREFIJO = prefijoTelefono(ID)
const FUENTE = `prueba-agente-${ID}`
const db = supabaseAdmin()
const tel = (n: number) => `${PREFIJO}${String(n).padStart(2, '0')}`

beforeAll(async () => {
  const prospectos = await db.from('prospectos').insert([
    {
      nombre: `Catering Prueba ${ID}`,
      segmento: 'catering',
      tipo_telefono: 'celular',
      telefono: tel(1),
      cobertura: 'dentro',
      estado: 'contactado',
      primer_contacto_en: new Date().toISOString(),
      canal_primer_contacto: 'plantilla_whatsapp',
      fuente: FUENTE,
      fuente_ref: 'a',
    },
    {
      nombre: `Hogar Prueba ${ID}`,
      segmento: 'hogares de ancianos',
      tipo_telefono: 'celular',
      telefono: tel(2),
      cobertura: 'dentro',
      estado: 'nuevo',
      fuente: FUENTE,
      fuente_ref: 'b',
    },
  ])
  const admin = await db
    .from('operador_whitelist')
    .insert({ telefono: tel(9), nombre: `Admin ${ID}`, nivel: 'admin' })
  for (const r of [prospectos, admin]) if (r.error) throw new Error(r.error.message)
})

afterAll(async () => {
  await db.from('conversaciones').delete().like('telefono', `${PREFIJO}%`)
  await db.from('operador_whitelist').delete().like('telefono', `${PREFIJO}%`)
  await db.from('prospectos').delete().eq('fuente', FUENTE)
})

describe('el agente reconoce a un prospecto que escribe', () => {
  it('le entrega el nombre del negocio y el segmento', async () => {
    const r = await verificarWhitelistOperador({ telefono: tel(1) })
    if (!r.ok) throw new Error('debía responder')
    expect(r.data.es_operador).toBe(false)
    expect(r.data.prospecto).toEqual({
      nombre: `Catering Prueba ${ID}`,
      segmento: 'catering',
      ya_se_le_escribio: true,
    })
  })

  it('distingue al que nunca recibió el primer mensaje', async () => {
    const r = await verificarWhitelistOperador({ telefono: tel(2) })
    if (!r.ok) throw new Error('debía responder')
    expect(r.data.prospecto?.ya_se_le_escribio).toBe(false)
  })

  it('un número desconocido no trae prospecto', async () => {
    const r = await verificarWhitelistOperador({ telefono: tel(5) })
    if (!r.ok) throw new Error('debía responder')
    expect(r.data.prospecto).toBeNull()
  })
})

describe('«no me escriban más» de un prospecto', () => {
  it('lo deja como «no contactar» en la lista, además de en la conversación', async () => {
    const r = await noSeguir({ telefono: tel(1) })
    expect(r.ok).toBe(true)
    const { data } = await db.from('prospectos').select('estado').eq('telefono', tel(1)).single()
    expect(data?.estado).toBe('no_contactar')
  })

  it('un número que no es prospecto sigue funcionando como antes', async () => {
    const r = await noSeguir({ telefono: tel(6) })
    expect(r.ok).toBe(true)
  })
})

describe('la dueña pregunta cómo va la prospección', () => {
  it('recibe el estado del envío automático y las cifras, sin teléfonos', async () => {
    const r = await consultaAdmin({ telefono_operador: tel(9), consulta: 'prospeccion' })
    if (!r.ok) throw new Error('debía responder')
    const datos = r.data as Record<string, unknown>
    expect(typeof datos.envio_automatico_encendido).toBe('boolean')
    expect(datos.limite_diario).toEqual(expect.any(Number))
    expect(datos.total).toEqual(expect.any(Number))
    expect(datos.por_etapa).toBeTypeOf('object')
    expect(JSON.stringify(datos)).not.toContain(PREFIJO)
  })
})
