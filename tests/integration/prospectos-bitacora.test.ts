import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { historial, registrarContacto, unirHistorial } from '@/server/prospectos/bitacora'
import { PLANTILLA_PRIMER_CONTACTO } from '@/server/prospectos/mensaje'
import { cambiarEstado, guardarNotas } from '@/server/prospectos/repo'
import { noSeguir } from '@/server/webhook/handlers/no-seguir'
import { marcarPlantillaAccion } from '@/server/webhook/handlers/plantillas'
import { corrida, prefijoTelefono } from '../util/corrida.ts'

/** La bitácora de contactos con prospectos, con datos propios de la corrida. */
const ID = corrida()
const PREFIJO = prefijoTelefono(ID)
const FUENTE = `prueba-bitacora-${ID}`
const db = supabaseAdmin()
const tel = (n: number) => `${PREFIJO}${String(n).padStart(2, '0')}`
const ids: Record<string, string> = {}

beforeAll(async () => {
  const { data, error } = await db
    .from('prospectos')
    .insert(
      ['a', 'b', 'c'].map((clave, i) => ({
        nombre: `Bitácora ${clave} ${ID}`,
        segmento: 'catering',
        tipo_telefono: 'celular',
        telefono: tel(i + 1),
        cobertura: 'dentro',
        estado: 'nuevo',
        fuente: FUENTE,
        fuente_ref: clave,
      })),
    )
    .select('id, fuente_ref')
  if (error) throw new Error(error.message)
  for (const f of data) ids[f.fuente_ref as string] = f.id
})

afterAll(async () => {
  await db.from('plantillas_enviadas').delete().like('telefono', `${PREFIJO}%`)
  await db.from('conversaciones').delete().like('telefono', `${PREFIJO}%`)
  await db.from('prospectos').delete().eq('fuente', FUENTE) // la bitácora cae en cascada
})

describe('la bitácora registra cada contacto', () => {
  it('el mensaje en frío por plantilla queda anotado como automático, una sola vez', async () => {
    const parametros = {
      telefono: tel(1),
      plantilla: PLANTILLA_PRIMER_CONTACTO,
      clave: ids.a as string,
    }
    await marcarPlantillaAccion(parametros)
    await marcarPlantillaAccion(parametros)
    const h = await historial(ids.a as string)
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({
      tipo: 'primer_contacto',
      canal: 'plantilla_whatsapp',
      automatico: true,
      autor: 'Automático',
    })
  })

  it('lo que hace el equipo a mano lleva el nombre de quien lo hizo', async () => {
    await cambiarEstado(ids.b as string, 'contactado', 'llamada', 'María Prueba')
    await guardarNotas(ids.b as string, 'Pidió cotización de manteles', 'María Prueba')
    await registrarContacto({
      prospectoId: ids.b as string,
      tipo: 'seguimiento',
      canal: 'whatsapp',
      resultado: 'Quedó en responder el viernes',
      autor: 'María Prueba',
    })
    const h = await historial(ids.b as string)
    expect(h.map((c) => c.tipo).sort()).toEqual(['nota', 'primer_contacto', 'seguimiento'])
    expect(h.every((c) => c.autor === 'María Prueba' && !c.automatico)).toBe(true)
  })

  it('cuando pide que no le escriban, queda la baja una sola vez', async () => {
    await noSeguir({ telefono: tel(3) })
    await noSeguir({ telefono: tel(3) })
    const h = await historial(ids.c as string)
    expect(h.filter((c) => c.tipo === 'baja')).toHaveLength(1)
  })

  it('el historial general trae el de varios prospectos, de lo más nuevo a lo más viejo', async () => {
    const todos = (await historial()).filter((c) => Object.values(ids).includes(c.prospecto_id))
    expect(new Set(todos.map((c) => c.prospecto_id)).size).toBe(3)
    const fechas = todos.map((c) => c.ocurrio_en)
    expect(fechas).toEqual([...fechas].sort().reverse())
  })
})

describe('unirHistorial', () => {
  it('suma la respuesta y los seguimientos del agente y ordena todo', () => {
    const anotado = {
      id: '1',
      prospecto_id: 'p1',
      ocurrio_en: '2026-10-21T15:00:00Z',
      tipo: 'primer_contacto' as const,
      canal: 'plantilla_whatsapp' as const,
      resultado: 'Enviado',
      detalle: '',
      autor: 'Automático',
      automatico: true,
    }
    const unido = unirHistorial(
      [anotado],
      [
        { telefono: '+593900000001', fecha: '2026-10-21T16:00:00Z', tipo: 'respuesta', texto: '' },
        {
          telefono: '+593900000001',
          fecha: '2026-10-22T10:00:00Z',
          tipo: 'agente',
          texto: 'Enviado: hola',
        },
        {
          telefono: '+593900000009',
          fecha: '2026-10-22T11:00:00Z',
          tipo: 'agente',
          texto: 'ajeno',
        },
      ],
      new Map([['+593900000001', 'p1']]),
    )
    expect(unido.map((c) => c.tipo)).toEqual(['agente', 'respuesta', 'primer_contacto'])
  })
})
