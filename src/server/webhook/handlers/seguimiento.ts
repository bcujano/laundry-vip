import { supabaseAdmin } from '@/lib/supabase/admin'
import { buscarCandidatos, registrarSeguimiento } from '@/server/seguimiento/repo'
import { exito, fallo, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'
import { findOrCreateClient } from './cliente'

/** Quién necesita un seguimiento ahora. n8n lo consulta cada 30 minutos. */
export async function candidatosSeguimiento(): Promise<
  ResultadoAccion<Awaited<ReturnType<typeof buscarCandidatos>>>
> {
  return exito(await buscarCandidatos())
}

/** Deja constancia de lo que se escribió (o se dejó de borrador). */
export async function anotarSeguimiento(
  parametros: ParametrosDe<'registrar_seguimiento'>,
): Promise<ResultadoAccion<{ registrado: true }>> {
  if (parametros.mensaje.trim() === '') return fallo('PARAMETROS_INVALIDOS', 'Mensaje vacío.')
  await registrarSeguimiento(parametros)
  return exito({ registrado: true })
}

/**
 * El seguimiento leyó la conversación en Chatwoot y concluyó cómo terminó:
 * contrató, agendó o dijo que no. Si compró, el cliente tiene que estar en el CRM:
 * se crea si falta. El pedido NO se inventa desde un chat (no hay prendas ni
 * precios confiables): se avisa si falta para que lo cree una persona.
 * No toca `ultima_interaccion`: no es un mensaje del cliente y no debe reiniciar
 * la cuenta del silencio.
 */
export async function registrarConversion(
  parametros: ParametrosDe<'registrar_conversion'>,
): Promise<
  ResultadoAccion<{ cliente_id: string | null; cliente_creado: boolean; pedido_en_crm: boolean }>
> {
  const db = supabaseAdmin()
  let clienteId: string | null = null
  let creado = false

  if (parametros.estado !== 'rechazado') {
    const r = await findOrCreateClient({
      telefono: parametros.telefono,
      canal_origen: 'whatsapp_agente',
      ...(parametros.nombre_contacto ? { nombre_contacto: parametros.nombre_contacto } : {}),
    } as ParametrosDe<'find_or_create_client'>)
    if (!r.ok) return fallo(r.codigo, r.mensaje, r.estadoHttp)
    clienteId = r.data.cliente.id
    creado = r.data.creado
  }

  const { data: fila } = await db
    .from('conversaciones')
    .select('contexto')
    .eq('telefono', parametros.telefono)
    .maybeSingle()
  const contexto = {
    ...((fila?.contexto as Record<string, unknown> | null) ?? {}),
    estado_comercial: parametros.estado,
    estado_comercial_detalle: parametros.detalle,
    estado_comercial_en: new Date().toISOString(),
  }
  const { error } = await db
    .from('conversaciones')
    .update({ contexto })
    .eq('telefono', parametros.telefono)
  if (error) return fallo('ERROR_INTERNO', error.message, 500)

  let pedidoEnCrm = false
  if (clienteId) {
    const { data: pedidos } = await db
      .from('pedidos')
      .select('id')
      .eq('cliente_id', clienteId)
      .neq('estado', 'cancelado')
      .limit(1)
    pedidoEnCrm = (pedidos ?? []).length > 0
  }
  return exito({ cliente_id: clienteId, cliente_creado: creado, pedido_en_crm: pedidoEnCrm })
}
