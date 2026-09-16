import { supabaseAdmin } from '@/lib/supabase/admin'
import { limitesDelDia } from '@/server/scheduling/ventana'
import type { Conversacion } from '@/types/database'

/**
 * Embudo de leads del agente de WhatsApp. Un lead es cualquier teléfono que
 * le escribió al agente, haya pedido o no. Los operadores de planta no cuentan:
 * le escriben al agente para trabajar, no para comprar.
 */

export type LeadResumen = {
  telefono: string
  clienteId: string | null
  nombre: string
  temperatura: string | null
  necesidad: string | null
  ultimaInteraccion: string
}

export type EmbudoLeads = {
  leadsHoy: number
  leads30: number
  convertidos30: number
  tasaConversion: number
  calientesSinPedido: number
  escalados: number
  sinPedido: LeadResumen[]
}

type ClienteConPedidos = {
  id: string
  telefono: string
  nombre_contacto: string | null
  nombre_negocio: string | null
  pedidos: { count: number }[]
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

export function resumirEmbudo(
  conversaciones: Conversacion[],
  clientes: ClienteConPedidos[],
  operadores: Set<string>,
  ahora: Date,
): EmbudoLeads {
  const { desde } = limitesDelDia(ahora)
  const haceUnMes = ahora.getTime() - 30 * 24 * 60 * 60 * 1000
  const porTelefono = new Map(clientes.map((cliente) => [cliente.telefono, cliente]))

  const leads = conversaciones.filter((c) => !operadores.has(c.telefono))
  const delMes = leads.filter((c) => new Date(c.created_at).getTime() >= haceUnMes)
  const pedidosDe = (telefono: string) => porTelefono.get(telefono)?.pedidos?.[0]?.count ?? 0

  const convertidos = delMes.filter((c) => pedidosDe(c.telefono) > 0).length
  const sinPedido = leads
    .filter((c) => pedidosDe(c.telefono) === 0)
    .sort((a, b) => b.ultima_interaccion.localeCompare(a.ultima_interaccion))

  return {
    leadsHoy: leads.filter((c) => new Date(c.created_at) >= desde).length,
    leads30: delMes.length,
    convertidos30: convertidos,
    tasaConversion: delMes.length === 0 ? 0 : Math.round((convertidos / delMes.length) * 100),
    calientesSinPedido: sinPedido.filter((c) => c.contexto.temperatura === 'caliente').length,
    escalados: leads.filter((c) => c.contexto.escalado === true).length,
    sinPedido: sinPedido.slice(0, 8).map((c) => {
      const cliente = porTelefono.get(c.telefono)
      return {
        telefono: c.telefono,
        clienteId: cliente?.id ?? null,
        nombre:
          cliente?.nombre_negocio ||
          cliente?.nombre_contacto ||
          texto(c.contexto.nombre_whatsapp) ||
          c.telefono,
        temperatura: texto(c.contexto.temperatura),
        necesidad: texto(c.contexto.necesidad),
        ultimaInteraccion: c.ultima_interaccion,
      }
    }),
  }
}

export async function embudoLeads(ahora = new Date()): Promise<EmbudoLeads> {
  const supabase = supabaseAdmin()

  const [conversaciones, operadores] = await Promise.all([
    supabase
      .from('conversaciones')
      .select('*')
      .order('ultima_interaccion', { ascending: false })
      .limit(1000),
    supabase.from('operador_whitelist').select('telefono').eq('activo', true),
  ])

  const filas = (conversaciones.data ?? []) as Conversacion[]
  const telefonos = filas.map((fila) => fila.telefono)

  const clientes =
    telefonos.length === 0
      ? { data: [] }
      : await supabase
          .from('clientes')
          .select('id, telefono, nombre_contacto, nombre_negocio, pedidos(count)')
          .in('telefono', telefonos)

  return resumirEmbudo(
    filas,
    (clientes.data ?? []) as unknown as ClienteConPedidos[],
    new Set((operadores.data ?? []).map((fila) => fila.telefono as string)),
    ahora,
  )
}
