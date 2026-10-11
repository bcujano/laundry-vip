import { supabaseAdmin } from '@/lib/supabase/admin'
import { crearAvisoEquipo } from '@/server/avisos-equipo/repo'
import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import { evaluarCobertura } from '@/server/pedidos/cobertura-geo'
import { crearPedido } from '@/server/pedidos/crear'
import { geocodificar } from '@/server/pedidos/geocodificar'
import { obtener as obtenerPedido, ultimoDelCliente } from '@/server/pedidos/repo'
import { requiereRevisionDelEquipo } from '@/server/pedidos/revision'
import { ErrorCotizacion } from '@/server/pricing/cotizar'
import type { Cliente, Pedido } from '@/types/database'
import { exito, fallo, noEncontrado, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/** Lo que el agente necesita saber de un pedido para poder hablar de él. */
function resumirPedido(pedido: Pedido) {
  return {
    pedido_id: pedido.id,
    estado: pedido.estado,
    canal: pedido.canal,
    tipo_entrega: pedido.tipo_entrega,
    monto_estimado_lavado: pedido.monto_estimado_lavado,
    monto_confirmado_lavado: pedido.monto_confirmado_lavado,
    monto_recoleccion_entrega: pedido.monto_recoleccion_entrega,
    monto_recoleccion: pedido.monto_recoleccion,
    monto_entrega: pedido.monto_entrega,
    pago_recoleccion: pedido.pago_recoleccion,
    pago_entrega: pedido.pago_entrega,
    pago_lavado: pedido.pago_lavado,
    vehiculo_sugerido: pedido.vehiculo_sugerido,
    numero_fundas: pedido.numero_fundas,
    ventana_recoleccion_inicio: pedido.ventana_recoleccion_inicio,
    ventana_recoleccion_fin: pedido.ventana_recoleccion_fin,
    discrepancia_detectada: pedido.discrepancia_detectada,
    discrepancia_motivo: pedido.discrepancia_motivo,
    creado_en: pedido.created_at,
  }
}

export async function crear(
  parametros: ParametrosDe<'crear_pedido'>,
): Promise<ResultadoAccion<unknown>> {
  try {
    // La cobertura la hace cumplir el servidor, no el modelo. Solo al pedido que llega
    // por el agente: el equipo puede crear desde el CRM una excepción a mano.
    if (parametros.canal === 'whatsapp_agente' && parametros.tipo_entrega === 'combo') {
      const config = await obtenerConfig()
      const veredicto = await evaluarCobertura(
        { sector: parametros.sector, direccion: parametros.direccion_recoleccion },
        config,
        (texto) => geocodificar(texto),
      )
      if (veredicto.estado === 'falta_sector') {
        return fallo(
          'PARAMETROS_INVALIDOS',
          'Falta el sector o barrio de la recogida. Pregúntaselo al cliente.',
        )
      }
      if (veredicto.estado === 'fuera') {
        return fallo(
          'FUERA_DE_COBERTURA',
          'Por ese sector no se recoge. Díselo en una frase, sin explicar distancias, y ofrécele traer y retirar su ropa en el local, sin recargo.',
        )
      }
    }

    const resultado = await crearPedido({
      clienteId: parametros.cliente_id,
      canal: parametros.canal,
      tipoEntrega: parametros.tipo_entrega,
      items: parametros.items,
      metodoRecoleccion: parametros.metodo_transporte_recoleccion,
      metodoEntrega: parametros.metodo_transporte_entrega,
      montoRecoleccion: parametros.monto_recoleccion,
      montoEntrega: parametros.monto_entrega,
      numeroFundas: parametros.numero_fundas,
      direccionRecoleccion: parametros.direccion_recoleccion,
      ventanaInicio: parametros.ventana_recoleccion_inicio,
      ventanaFin: parametros.ventana_recoleccion_fin,
    })

    if (!resultado.ok) {
      const estadoHttp = resultado.codigo === 'NO_ENCONTRADO' ? 404 : 400
      return fallo(resultado.codigo, resultado.mensaje, estadoHttp)
    }

    // Pedido grande: se avisa al equipo y el agente le dice al cliente que una persona lo confirma.
    const grande =
      parametros.canal === 'whatsapp_agente' &&
      requiereRevisionDelEquipo(parametros.items, resultado.pedido.monto_estimado_lavado)
    if (grande) {
      await crearAvisoEquipo({
        tipo: 'pedido_borrador',
        caso: `pedido-${resultado.pedido.id}`,
        resumen: `Pedido grande por confirmar: estimado $${Number(resultado.pedido.monto_estimado_lavado ?? 0).toFixed(2)}. Revíselo en el CRM antes de recoger.`,
      })
    }

    return exito({
      ...resumirPedido(resultado.pedido),
      // El monto del agente SIEMPRE es un estimado hasta que planta cuente.
      estado_cotizacion: 'estimado_pendiente_verificacion',
      requiere_respuesta_del_cliente: resultado.requiereRespuestaDelCliente,
      ...(grande
        ? {
            confirma_el_equipo: true,
            instruccion:
              'El pedido quedó registrado, pero es grande: dile al cliente que una persona del equipo lo confirma con él en breve.',
          }
        : {}),
    })
  } catch (error) {
    if (error instanceof ErrorCotizacion) return fallo(error.codigo, error.message, 400)
    throw error
  }
}

/** "¿Cómo va lo mío?" — devuelve el pedido más reciente de ese teléfono. */
export async function consultarEstadoPorTelefono(
  parametros: ParametrosDe<'consultar_estado_pedido'>,
): Promise<ResultadoAccion<unknown>> {
  const { data: cliente } = await supabaseAdmin()
    .from('clientes')
    .select('*')
    .eq('telefono', parametros.telefono)
    .maybeSingle()

  if (!cliente) return noEncontrado('Ese teléfono no tiene ningún cliente registrado.')

  const pedido = await ultimoDelCliente((cliente as Cliente).id)
  if (!pedido) return noEncontrado('Ese cliente todavía no tiene pedidos.')

  return exito(resumirPedido(pedido))
}

/** Consulta directa por id, para el modo operador. */
export async function consultarPedidoPorId(
  parametros: ParametrosDe<'consultar_pedido'>,
): Promise<ResultadoAccion<unknown>> {
  const detalle = await obtenerPedido(parametros.pedido_id)
  if (!detalle) return noEncontrado('Ese pedido no existe.')

  return exito({
    ...resumirPedido(detalle.pedido),
    cliente: detalle.pedido.cliente,
    prendas: detalle.items.map((item) => ({
      origen: item.origen,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      metodo: item.metodo_elegido,
      precio_unitario: item.precio_unitario,
      subtotal: item.subtotal,
      no_reconocido: item.no_reconocido,
    })),
    correcciones: detalle.correcciones.length,
  })
}
