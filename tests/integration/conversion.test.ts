import { NextRequest } from 'next/server'
import { afterAll, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/webhook/route'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { corrida, prefijoTelefono } from '../util/corrida.ts'

const SECRETO = process.env.N8N_WEBHOOK_SECRET as string
const PREFIJO = prefijoTelefono(corrida())

async function llamar(cuerpo: unknown) {
  const peticion = new NextRequest('http://localhost:3000/api/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-webhook-secret': SECRETO },
    body: JSON.stringify(cuerpo),
  })
  const r = await POST(peticion)
  return (await r.json()) as {
    ok: boolean
    data?: { cliente_id: string | null; cliente_creado: boolean; pedido_en_crm: boolean }
  }
}

afterAll(async () => {
  const db = supabaseAdmin()
  await db.from('conversaciones').delete().like('telefono', `${PREFIJO}%`)
  await db.from('clientes').delete().like('telefono', `${PREFIJO}%`)
})

describe('conversión detectada en Chatwoot (registrar_conversion)', () => {
  it('si contrató y no estaba en el CRM, lo agrega; sin pedido, avisa que falta', async () => {
    const telefono = `${PREFIJO}01`
    const fecha = '2026-01-01T00:00:00.000Z'
    await supabaseAdmin()
      .from('conversaciones')
      .insert({ telefono, contexto: { temperatura: 'tibio' }, ultima_interaccion: fecha })

    const r = await llamar({
      accion: 'registrar_conversion',
      parametros: {
        telefono,
        estado: 'vendido',
        detalle: 'confirmó recogida mañana',
        nombre_contacto: 'Ana Prueba',
      },
    })
    expect(r.ok).toBe(true)
    expect(r.data?.cliente_creado).toBe(true)
    expect(r.data?.pedido_en_crm).toBe(false)

    const { data: cliente } = await supabaseAdmin()
      .from('clientes')
      .select('id')
      .eq('telefono', telefono)
    expect(cliente).toHaveLength(1)

    const { data: conv } = await supabaseAdmin()
      .from('conversaciones')
      .select('contexto, ultima_interaccion')
      .eq('telefono', telefono)
      .single()
    const contexto = (conv?.contexto ?? {}) as Record<string, string>
    expect(contexto.estado_comercial).toBe('vendido')
    expect(contexto.temperatura).toBe('tibio')
    // no reinicia la cuenta del silencio
    expect(new Date(conv?.ultima_interaccion as string).getTime()).toBe(new Date(fecha).getTime())
  })

  it('si dijo que no, no crea cliente', async () => {
    const telefono = `${PREFIJO}02`
    await supabaseAdmin().from('conversaciones').insert({ telefono, contexto: {} })
    const r = await llamar({
      accion: 'registrar_conversion',
      parametros: { telefono, estado: 'rechazado', detalle: 'ya contrató a otra lavandería' },
    })
    expect(r.ok).toBe(true)
    expect(r.data?.cliente_id).toBeNull()
    const { data } = await supabaseAdmin().from('clientes').select('id').eq('telefono', telefono)
    expect(data).toHaveLength(0)
  })
})
