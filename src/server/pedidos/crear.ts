import { supabaseAdmin } from '@/lib/supabase/admin'
import { obtener as obtenerConfig, parametrosVentana } from '@/server/configuracion/repo'
import { calcularVehiculo, cotizarPrendas, type ItemPedido } from '@/server/pricing/cotizar'
import { obtenerProximaVentana } from '@/server/scheduling/ventana'
import type { Cliente, EstadoPedido, Pedido } from '@/types/database'

export type EntradaPedido = {
  clienteId: string
  canal: 'whatsapp_agente' | 'presencial'
  tipoEntrega?: 'combo' | 'a_la_carta'
  items: ItemPedido[]
  metodoRecoleccion?: 'app' | 'propio_cliente' | 'n_a'
  metodoEntrega?: 'app' | 'propio_cliente' | 'n_a'
  montoRecoleccion?: number
  montoEntrega?: number
  numeroFundas?: number
  direccionRecoleccion?: string
  ventanaInicio?: string
  ventanaFin?: string
}

export type ResultadoCrear =
  | { ok: true; pedido: Pedido; montoEstimadoLavado: number; requiereRespuestaDelCliente: boolean }
  | {
      ok: false
      codigo: 'NO_ENCONTRADO' | 'ITEMS_VACIOS' | 'PARAMETROS_INVALIDOS' | 'ERROR_INTERNO'
      mensaje: string
    }

type Logistica = {
  estado: EstadoPedido
  metodo_transporte_recoleccion: 'app' | 'propio_cliente' | 'n_a'
  metodo_transporte_entrega: 'app' | 'propio_cliente' | 'n_a'
  pago_recoleccion: 'pagado' | 'pendiente' | 'n_a'
  pago_entrega: 'pagado' | 'pendiente' | 'n_a'
  monto_recoleccion: number | null
  monto_entrega: number | null
  monto_recoleccion_entrega: number | null
}

/**
 * La matriz de pagos, en un solo lugar.
 *
 *   presencial   -> no hay logística: el cliente vino al local.
 *   combo        -> tarifa plana vigente; la lavandería gestiona y paga ambos
 *                   tramos y cobra ese plano sin importar el costo real.
 *   a la carta   -> tramo por tramo. "propio_cliente" no bloquea nada porque
 *                   la lavandería no gestiona ni paga ese tramo; "app" se cobra
 *                   a costo real y queda pendiente.
 *
 * Si algún tramo queda en app + pendiente, el pedido nace esperando ese pago.
 */
function resolverLogistica(entrada: EntradaPedido, tarifaCombo: number): Logistica {
  if (entrada.canal === 'presencial') {
    return {
      estado: 'nuevo',
      metodo_transporte_recoleccion: 'n_a',
      metodo_transporte_entrega: 'n_a',
      pago_recoleccion: 'n_a',
      pago_entrega: 'n_a',
      monto_recoleccion: null,
      monto_entrega: null,
      monto_recoleccion_entrega: null,
    }
  }

  if (entrada.tipoEntrega === 'combo') {
    return {
      estado: 'nuevo',
      metodo_transporte_recoleccion: 'n_a',
      metodo_transporte_entrega: 'n_a',
      pago_recoleccion: 'n_a',
      pago_entrega: 'n_a',
      monto_recoleccion: null,
      monto_entrega: null,
      monto_recoleccion_entrega: tarifaCombo,
    }
  }

  const recoleccion = entrada.metodoRecoleccion ?? 'n_a'
  const entrega = entrada.metodoEntrega ?? 'n_a'
  const pagoRecoleccion = recoleccion === 'app' ? 'pendiente' : 'n_a'
  const pagoEntrega = entrega === 'app' ? 'pendiente' : 'n_a'
  const hayTramoPendiente = pagoRecoleccion === 'pendiente' || pagoEntrega === 'pendiente'

  return {
    estado: hayTramoPendiente ? 'esperando_pago_para_recoleccion' : 'nuevo',
    metodo_transporte_recoleccion: recoleccion,
    metodo_transporte_entrega: entrega,
    pago_recoleccion: pagoRecoleccion,
    pago_entrega: pagoEntrega,
    monto_recoleccion: recoleccion === 'app' ? (entrada.montoRecoleccion ?? null) : null,
    monto_entrega: entrega === 'app' ? (entrada.montoEntrega ?? null) : null,
    monto_recoleccion_entrega: null,
  }
}

/**
 * Crea el pedido, sus prendas declaradas y su primer evento.
 * Los precios se recalculan aquí contra el catálogo: no se acepta ningún
 * monto que venga de fuera, porque el agente no es fuente de verdad de precios.
 */
export async function crearPedido(entrada: EntradaPedido): Promise<ResultadoCrear> {
  if (entrada.items.length === 0) {
    return { ok: false, codigo: 'ITEMS_VACIOS', mensaje: 'Un pedido sin prendas no es un pedido.' }
  }
  if (entrada.canal === 'whatsapp_agente' && !entrada.tipoEntrega) {
    return {
      ok: false,
      codigo: 'PARAMETROS_INVALIDOS',
      mensaje:
        'Falta tipo_entrega: hay que saber si la lavandería recoge o el cliente trae la ropa.',
    }
  }

  // Si la lavandería va a recoger, sin dirección no hay pedido: el agente ya
  // cerró uno con la dirección vacía y nadie supo a dónde ir.
  if (entrada.tipoEntrega === 'combo' && (entrada.direccionRecoleccion ?? '').trim() === '') {
    return {
      ok: false,
      codigo: 'PARAMETROS_INVALIDOS',
      mensaje:
        'Falta la dirección de recolección. Pregúntasela al cliente antes de confirmar el pedido.',
    }
  }

  const cliente = supabaseAdmin()

  const { data: filaCliente } = await cliente
    .from('clientes')
    .select('*')
    .eq('id', entrada.clienteId)
    .maybeSingle()

  if (!filaCliente) {
    return { ok: false, codigo: 'NO_ENCONTRADO', mensaje: 'Ese cliente no existe.' }
  }
  const datosCliente = filaCliente as Cliente

  const config = await obtenerConfig()

  const cotizacion = await cotizarPrendas(entrada.items)
  const logistica = resolverLogistica(entrada, Number(config.tarifa_recoleccion_entrega))

  // Excepción que manda sobre todo lo anterior: un cliente que factura al mes
  // nunca se bloquea por el pago de un pedido suelto.
  const esConsolidado = datosCliente.modelo_facturacion === 'consolidado_mensual'
  const { estado: estadoSegunPagos, ...tramos } = logistica
  const estado: EstadoPedido = esConsolidado ? 'nuevo' : estadoSegunPagos

  const ventana = entrada.ventanaInicio
    ? { inicio: entrada.ventanaInicio, fin: entrada.ventanaFin ?? null }
    : await ventanaPorDefecto(entrada.canal)

  const { data: pedido, error } = await cliente
    .from('pedidos')
    .insert({
      cliente_id: entrada.clienteId,
      canal: entrada.canal,
      estado,
      tipo_entrega: entrada.canal === 'presencial' ? null : (entrada.tipoEntrega ?? null),
      ...tramos,
      pago_lavado: esConsolidado ? 'acumulado_mensual' : 'estimado',
      monto_estimado_lavado: cotizacion.resumen.subtotal,
      numero_fundas: entrada.canal === 'presencial' ? null : (entrada.numeroFundas ?? null),
      vehiculo_sugerido:
        entrada.canal === 'presencial' || !entrada.numeroFundas
          ? null
          : calcularVehiculo(entrada.numeroFundas),
      direccion_recoleccion:
        entrada.canal === 'presencial' ? null : (entrada.direccionRecoleccion ?? null),
      ventana_recoleccion_inicio: entrada.canal === 'presencial' ? null : ventana.inicio,
      ventana_recoleccion_fin: entrada.canal === 'presencial' ? null : ventana.fin,
    })
    .select('*')
    .single()

  if (error || !pedido) {
    return { ok: false, codigo: 'ERROR_INTERNO', mensaje: error?.message ?? 'No se pudo crear.' }
  }

  const filaPedido = pedido as Pedido

  const prendas = cotizacion.lineas.map((linea) => ({
    pedido_id: filaPedido.id,
    origen: 'declarado' as const,
    servicio_id: linea.servicio_id ?? null,
    descripcion: linea.nombre_item ?? linea.descripcion,
    cantidad: linea.cantidad,
    metodo_elegido: linea.metodo ?? null,
    precio_unitario: linea.precio_unitario ?? null,
    subtotal: linea.subtotal ?? null,
    no_reconocido: !linea.encontrado,
  }))

  const { error: errorItems } = await cliente.from('pedido_items').insert(prendas)
  if (errorItems) {
    return { ok: false, codigo: 'ERROR_INTERNO', mensaje: errorItems.message }
  }

  await cliente.from('pedido_eventos').insert({
    pedido_id: filaPedido.id,
    estado_anterior: null,
    estado_nuevo: estado,
    actor: entrada.canal === 'presencial' ? 'operador' : 'agente',
    motivo: 'Pedido creado',
  })

  return {
    ok: true,
    pedido: filaPedido,
    montoEstimadoLavado: cotizacion.resumen.subtotal,
    requiereRespuestaDelCliente: cotizacion.resumen.requiere_respuesta_del_cliente,
  }
}

async function ventanaPorDefecto(
  canal: EntradaPedido['canal'],
): Promise<{ inicio: string | null; fin: string | null }> {
  if (canal === 'presencial') return { inicio: null, fin: null }

  const ventana = obtenerProximaVentana(new Date(), await parametrosVentana())
  return { inicio: ventana.inicio.toISOString(), fin: ventana.fin.toISOString() }
}
