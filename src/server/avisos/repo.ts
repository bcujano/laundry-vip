import { supabaseAdmin } from '@/lib/supabase/admin'
import { type DatosAviso, type DatosSinNombre, textoAviso } from './texto'

/** La ventana de texto libre de WhatsApp dura 24 h desde el último mensaje del cliente. */
const VENTANA_MINUTOS = 23 * 60 + 50

/**
 * Deja listo el aviso de una discrepancia. Nunca rompe la operación que lo
 * origina: si falla, la discrepancia sigue registrada y se avisa a mano.
 */
export async function crearAvisoDiscrepancia(
  pedidoId: string,
  datos: DatosSinNombre,
): Promise<void> {
  try {
    const db = supabaseAdmin()
    const { data: pedido } = await db
      .from('pedidos')
      .select('cliente_id')
      .eq('id', pedidoId)
      .maybeSingle()
    if (!pedido) return
    const { data: cliente } = await db
      .from('clientes')
      .select('telefono, nombre_contacto, nombre_contacto_origen')
      .eq('id', pedido.cliente_id)
      .maybeSingle()
    if (!cliente) return

    // El nombre del perfil de WhatsApp no cuenta como nombre dicho por el cliente.
    const nombre =
      cliente.nombre_contacto && cliente.nombre_contacto_origen !== 'whatsapp'
        ? cliente.nombre_contacto
        : null
    const texto = textoAviso({ ...datos, nombre } as DatosAviso)
    await db
      .from('avisos_cliente')
      .upsert(
        { pedido_id: pedidoId, telefono: cliente.telefono, tipo: datos.tipo, texto },
        { onConflict: 'pedido_id,texto', ignoreDuplicates: true },
      )
  } catch {
    // El aviso es un complemento: no puede tumbar el conteo ni la corrección.
  }
}

export type AvisoPendiente = {
  id: string
  telefono: string
  texto: string
  chatwoot_conversation_id: number | null
  ventana_abierta: boolean
}

export async function avisosPendientes(ahora = new Date()): Promise<AvisoPendiente[]> {
  const db = supabaseAdmin()
  const { data: avisos } = await db
    .from('avisos_cliente')
    .select('id, telefono, texto')
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: true })
    .limit(10)
  if (!avisos || avisos.length === 0) return []

  const { data: convs } = await db
    .from('conversaciones')
    .select('telefono, chatwoot_conversation_id, ultima_interaccion')
    .in(
      'telefono',
      avisos.map((a) => a.telefono),
    )
  const porTelefono = new Map((convs ?? []).map((c) => [c.telefono as string, c]))

  return avisos.map((a) => {
    const c = porTelefono.get(a.telefono)
    const minutos = c ? (ahora.getTime() - new Date(c.ultima_interaccion).getTime()) / 60_000 : null
    return {
      id: a.id as string,
      telefono: a.telefono as string,
      texto: a.texto as string,
      chatwoot_conversation_id: (c?.chatwoot_conversation_id as number | null) ?? null,
      ventana_abierta: minutos !== null && minutos < VENTANA_MINUTOS,
    }
  })
}

export async function marcarAviso(id: string, estado: 'enviado' | 'requiere_persona') {
  const { error } = await supabaseAdmin()
    .from('avisos_cliente')
    .update({ estado, resuelto_en: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`No se pudo marcar el aviso: ${error.message}`)
}
