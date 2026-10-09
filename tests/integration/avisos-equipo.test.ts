import { NextRequest } from 'next/server'
import { afterAll, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/webhook/route'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PREFIJO_PRUEBA } from '@/server/avisos-equipo/repo'
import { corrida } from '../util/corrida.ts'

/**
 * Contra la base real. Los casos llevan el prefijo de pruebas: el envío real
 * (n8n) nunca los manda, así que ninguna prueba le escribe al equipo.
 */
async function llamar(accion: string, parametros: unknown) {
  const peticion = new NextRequest('http://localhost/api/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET ?? '',
    },
    body: JSON.stringify({ accion, parametros }),
  })
  return (await (await POST(peticion)).json()) as { ok: boolean; data: Record<string, unknown> }
}

const caso = `${PREFIJO_PRUEBA}${corrida()}-${Date.now()}`
const conversacion = 900_000_000 + Math.floor(Math.random() * 99_999_999)

afterAll(async () => {
  await supabaseAdmin().from('avisos_equipo').delete().like('caso', `${PREFIJO_PRUEBA}%`)
})

describe('avisos del agente al equipo', () => {
  it('crea un aviso por caso: el segundo igual no se duplica y trae el plazo de respuesta', async () => {
    const datos = {
      tipo: 'reclamo',
      caso,
      chatwoot_conversation_id: conversacion,
      resumen: 'Prueba automática: no es un caso real.',
    }
    const primero = await llamar('crear_aviso_equipo', datos)
    const segundo = await llamar('crear_aviso_equipo', datos)

    expect(primero.data.creado).toBe(true)
    expect(segundo.data.creado).toBe(false)
    // La frase la calcula el servidor con el horario del local: nunca «pronto».
    expect(String(primero.data.plazo_respuesta)).toMatch(
      /^(en unos 30 minutos|hoy a partir de las|mañana a partir de las|el \S+ a partir de las)/,
    )
    const { data } = await supabaseAdmin().from('avisos_equipo').select('id').eq('caso', caso)
    expect(data).toHaveLength(1)
  })

  it('un tipo que no existe se guarda como «otro»', async () => {
    const otro = `${caso}-raro`
    await llamar('crear_aviso_equipo', { tipo: 'inventado', caso: otro, resumen: 'Prueba.' })
    const { data } = await supabaseAdmin().from('avisos_equipo').select('tipo').eq('caso', otro)
    expect(data?.[0]?.tipo).toBe('otro')
  })

  it('los casos de prueba no salen en la lista de pendientes por enviar', async () => {
    const { data } = await llamar('avisos_equipo_pendientes', {})
    const avisos = (data.avisos as { texto: string }[]).map((a) => a.texto).join('\n')
    expect(avisos).not.toContain('Prueba automática')
  })

  it('cuando una persona escribe en el chat, el aviso queda atendido y se puede abrir otro después', async () => {
    const atendidos = await llamar('atender_avisos_equipo', {
      chatwoot_conversation_id: conversacion,
    })
    expect(Number(atendidos.data.atendidos)).toBeGreaterThanOrEqual(1)

    const nuevo = await llamar('crear_aviso_equipo', {
      tipo: 'reclamo',
      caso,
      chatwoot_conversation_id: conversacion,
      resumen: 'Prueba automática: segundo aviso del mismo caso.',
    })
    expect(nuevo.data.creado).toBe(true)
  })

  it('rechaza parámetros inválidos', async () => {
    const r = await llamar('crear_aviso_equipo', { tipo: 'reclamo' })
    expect(r.ok).toBe(false)
  })
})
