import { supabaseAdmin } from '@/lib/supabase/admin'
import { confirmarPago, corregirCotizacion } from '@/server/pedidos/cobros'
import { crearPedido } from '@/server/pedidos/crear'
import { cotizarPrendas } from '@/server/pricing/cotizar'
import type { Cliente, Conversacion } from '@/types/database'
import { exito, fallo, noEncontrado, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/**
 * Modo operador. Todo lo de aquí exige que el número esté en la lista blanca:
 * el canal de WhatsApp puede registrar, corregir y consultar, pero NUNCA
 * borra nada. Eliminar obliga a entrar al CRM.
 */
async function exigirOperador(telefono: string): Promise<ResultadoAccion<never> | null> {
  const { data } = await supabaseAdmin()
    .from('operador_whitelist')
    .select('id')
    .eq('telefono', telefono)
    .eq('activo', true)
    .maybeSingle()

  return data
    ? null
    : fallo('OPERADOR_NO_AUTORIZADO', 'Ese número no está autorizado como operador.', 403)
}

/**
 * El último pedido que tocó este operador, guardado en su conversación.
 * Es lo que permite que "corrige: eran 4, no 5" actualice el mismo registro
 * en vez de crear uno nuevo.
 */
async function recordarUltimoPedido(telefonoOperador: string, pedidoId: string): Promise<void> {
  const cliente = supabaseAdmin()
  const { data } = await cliente
    .from('conversaciones')
    .select('contexto')
    .eq('telefono', telefonoOperador)
    .maybeSingle()

  const contexto = {
    ...((data as Conversacion | null)?.contexto ?? {}),
    ultimo_pedido_id: pedidoId,
  }

  await cliente
    .from('conversaciones')
    .upsert(
      { telefono: telefonoOperador, contexto, ultima_interaccion: new Date().toISOString() },
      { onConflict: 'telefono' },
    )
}

async function ultimoPedidoDe(telefonoOperador: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from('conversaciones')
    .select('contexto')
    .eq('telefono', telefonoOperador)
    .maybeSingle()

  const contexto = (data as Conversacion | null)?.contexto ?? {}
  const id = contexto.ultimo_pedido_id
  return typeof id === 'string' ? id : null
}

/** Un cliente que llegó al local, dictado por nota de voz. */
export async function registrarClientePresencial(
  parametros: ParametrosDe<'registrar_cliente_presencial'>,
): Promise<ResultadoAccion<unknown>> {
  const rechazo = await exigirOperador(parametros.telefono_operador)
  if (rechazo) return rechazo

  if (!parametros.telefono_cliente) {
    return fallo(
      'PARAMETROS_INVALIDOS',
      'Falta el teléfono del cliente: hace falta para avisarle cuando su ropa esté lista.',
    )
  }

  const supabase = supabaseAdmin()
  const { data: existente } = await supabase
    .from('clientes')
    .select('*')
    .eq('telefono', parametros.telefono_cliente)
    .maybeSingle()

  let cliente = existente as Cliente | null

  if (!cliente) {
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        telefono: parametros.telefono_cliente,
        nombre_contacto: parametros.nombre_contacto?.trim() || null,
        nombre_negocio: parametros.nombre_negocio?.trim() || null,
        canal_origen: 'presencial',
      })
      .select('*')
      .single()

    if (error) return fallo('ERROR_INTERNO', error.message, 500)
    cliente = data as Cliente
  }

  const resultado = await crearPedido({
    clienteId: cliente.id,
    canal: 'presencial',
    items: parametros.items,
  })

  if (!resultado.ok) {
    return fallo(
      resultado.codigo === 'NO_ENCONTRADO' ? 'NO_ENCONTRADO' : 'PARAMETROS_INVALIDOS',
      resultado.mensaje,
      resultado.codigo === 'NO_ENCONTRADO' ? 404 : 400,
    )
  }

  await recordarUltimoPedido(parametros.telefono_operador, resultado.pedido.id)

  return exito({
    pedido_id: resultado.pedido.id,
    cliente_id: cliente.id,
    cliente_creado: existente === null,
    estado: resultado.pedido.estado,
    monto_estimado_lavado: resultado.montoEstimadoLavado,
    estado_cotizacion: 'estimado_pendiente_verificacion',
  })
}

/**
 * Corrección por texto de lo que se acaba de dictar. Actualiza el MISMO
 * registro: nunca crea uno nuevo.
 */
export async function actualizarRegistro(
  parametros: ParametrosDe<'actualizar_registro'>,
): Promise<ResultadoAccion<unknown>> {
  const rechazo = await exigirOperador(parametros.telefono_operador)
  if (rechazo) return rechazo

  const pedidoId = parametros.pedido_id ?? (await ultimoPedidoDe(parametros.telefono_operador))
  if (!pedidoId) {
    return noEncontrado('No hay ningún registro reciente que corregir en esta conversación.')
  }

  const supabase = supabaseAdmin()
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('id, cliente_id')
    .eq('id', pedidoId)
    .maybeSingle()

  if (!pedido) return noEncontrado('Ese pedido ya no existe.')

  let montoEstimado: number | null = null

  if (parametros.items && parametros.items.length > 0) {
    const cotizacion = await cotizarPrendas(parametros.items)

    // Se reemplazan las prendas declaradas, no se añaden: corregir no duplica.
    await supabase.from('pedido_items').delete().eq('pedido_id', pedidoId).eq('origen', 'declarado')

    await supabase.from('pedido_items').insert(
      cotizacion.lineas.map((linea) => ({
        pedido_id: pedidoId,
        origen: 'declarado' as const,
        servicio_id: linea.servicio_id ?? null,
        descripcion: linea.nombre_item ?? linea.descripcion,
        cantidad: linea.cantidad,
        metodo_elegido: linea.metodo ?? null,
        precio_unitario: linea.precio_unitario ?? null,
        subtotal: linea.subtotal ?? null,
        no_reconocido: !linea.encontrado,
      })),
    )

    montoEstimado = cotizacion.resumen.subtotal
    await supabase
      .from('pedidos')
      .update({ monto_estimado_lavado: montoEstimado })
      .eq('id', pedidoId)
  }

  if (parametros.nombre_contacto || parametros.nombre_negocio) {
    const cambios: Record<string, string> = {}
    if (parametros.nombre_contacto?.trim())
      cambios.nombre_contacto = parametros.nombre_contacto.trim()
    if (parametros.nombre_negocio?.trim()) cambios.nombre_negocio = parametros.nombre_negocio.trim()
    await supabase.from('clientes').update(cambios).eq('id', pedido.cliente_id)
  }

  await supabase.from('pedido_eventos').insert({
    pedido_id: pedidoId,
    estado_nuevo: 'nuevo',
    actor: 'operador',
    motivo: 'Registro corregido por el operador',
  })

  return exito({
    pedido_id: pedidoId,
    actualizado: true,
    duplicado: false,
    monto_estimado_lavado: montoEstimado,
  })
}

export async function confirmarPagoOperador(
  parametros: ParametrosDe<'confirmar_pago'>,
): Promise<ResultadoAccion<unknown>> {
  const rechazo = await exigirOperador(parametros.telefono_operador)
  if (rechazo) return rechazo

  const resultado = await confirmarPago(parametros.pedido_id, parametros.tramo, {
    actor: 'operador',
  })

  if (!resultado.ok) {
    const esInexistente = resultado.error.includes('no existe')
    return fallo(
      esInexistente ? 'NO_ENCONTRADO' : 'ESTADO_INVALIDO',
      resultado.error,
      esInexistente ? 404 : 400,
    )
  }

  return exito({
    pedido_id: parametros.pedido_id,
    tramo: parametros.tramo,
    estado: resultado.datos.estado,
    despacho_liberado: resultado.datos.despachoLiberado,
  })
}

export async function corregirCotizacionOperador(
  parametros: ParametrosDe<'corregir_cotizacion'>,
): Promise<ResultadoAccion<unknown>> {
  const rechazo = await exigirOperador(parametros.telefono_operador)
  if (rechazo) return rechazo

  const resultado = await corregirCotizacion(
    parametros.pedido_id,
    parametros.monto_corregido,
    parametros.motivo,
    { actor: 'operador' },
  )

  if (!resultado.ok) {
    const esInexistente = resultado.error.includes('no existe')
    return fallo(
      esInexistente ? 'NO_ENCONTRADO' : 'PARAMETROS_INVALIDOS',
      resultado.error,
      esInexistente ? 404 : 400,
    )
  }

  return exito({
    pedido_id: parametros.pedido_id,
    monto_anterior: resultado.datos.montoAnterior,
    monto_corregido: resultado.datos.montoCorregido,
    motivo: parametros.motivo,
    // n8n avisa el motivo al cliente ANTES de pedirle el pago.
    notificar_cliente: true,
    pedido_congelado: true,
  })
}
