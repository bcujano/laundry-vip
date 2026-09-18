import { supabaseAdmin } from '@/lib/supabase/admin'
import { avanzarEstado } from '@/server/pedidos/estado'
import { verificarConteo } from '@/server/pedidos/verificacion'
import type { PedidoItem } from '@/types/database'
import { exito, fallo, noEncontrado, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'
import { recordarUltimoPedido, ultimoPedidoDe } from './operador'
import { exigirNivel, firma } from './permisos'

/**
 * Trabajo de planta por WhatsApp: encontrar un pedido, contarlo y moverlo.
 * Ninguna acción de aquí toca dinero: el conteo fija lo que se lavará, pero
 * una diferencia congela el pedido y se resuelve en el CRM.
 */

const CERRADOS = '("entregado","cancelado","recoleccion_fallida")'

/** «Lo de Juan», «el del 0991…»: el operador no conoce ids, conoce clientes. */
export async function buscarPedidos(
  parametros: ParametrosDe<'buscar_pedidos'>,
): Promise<ResultadoAccion<unknown>> {
  const permiso = await exigirNivel(parametros.telefono_operador, 'operador')
  if (!permiso.ok) return permiso.rechazo

  const texto = parametros.texto.replace(/[%_(),]/g, '').trim()
  const digitos = texto.replace(/\D/g, '')
  const patron = `%${digitos.length >= 6 ? digitos.slice(-8) : texto}%`

  const { data: clientes } = await supabaseAdmin()
    .from('clientes')
    .select('id, nombre_contacto, nombre_negocio, telefono')
    .or(`nombre_contacto.ilike.${patron},nombre_negocio.ilike.${patron},telefono.ilike.${patron}`)
    .limit(10)

  const ids = (clientes ?? []).map((cliente) => cliente.id)
  if (ids.length === 0) return noEncontrado(`No hay ningún cliente que coincida con «${texto}».`)

  const { data: pedidos } = await supabaseAdmin()
    .from('pedidos')
    .select('id, estado, created_at, monto_estimado_lavado, discrepancia_detectada, cliente_id')
    .in('cliente_id', ids)
    .not('estado', 'in', CERRADOS)
    .order('created_at', { ascending: false })
    .limit(10)

  const nombres = new Map(
    (clientes ?? []).map((c) => [c.id, c.nombre_negocio || c.nombre_contacto || c.telefono]),
  )

  return exito({
    pedidos: (pedidos ?? []).map((pedido) => ({
      pedido_id: pedido.id,
      cliente: nombres.get(pedido.cliente_id),
      estado: pedido.estado,
      creado: pedido.created_at,
      estimado_lavado: pedido.monto_estimado_lavado,
      congelado_por_discrepancia: pedido.discrepancia_detectada,
    })),
  })
}

/** «Lo de Juan ya está listo». El servidor valida que el salto sea legal. */
export async function avanzarEstadoPlanta(
  parametros: ParametrosDe<'avanzar_estado'>,
): Promise<ResultadoAccion<unknown>> {
  const permiso = await exigirNivel(parametros.telefono_operador, 'operador')
  if (!permiso.ok) return permiso.rechazo

  const pedidoId = parametros.pedido_id ?? (await ultimoPedidoDe(parametros.telefono_operador))
  if (!pedidoId) return noEncontrado('¿De qué pedido? Búscalo primero por el nombre del cliente.')

  const resultado = await avanzarEstado(pedidoId, parametros.estado, {
    actor: 'operador',
    motivo: firma(permiso.autorizado),
  })
  if (!resultado.ok) return fallo('ESTADO_INVALIDO', resultado.error, 400)

  await recordarUltimoPedido(parametros.telefono_operador, pedidoId)
  return exito({ pedido_id: pedidoId, estado: resultado.datos.estado })
}

/** Quita tildes y mayúsculas para emparejar «camisetas» con «Camiseta». */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/s\b/g, '')
    .trim()
}

/**
 * «Conté 10 manteles, no 12». Empareja lo dictado con las prendas declaradas
 * y delega en la verificación del CRM: si no cuadra, el pedido se congela.
 */
export async function registrarConteo(
  parametros: ParametrosDe<'registrar_conteo'>,
): Promise<ResultadoAccion<unknown>> {
  const permiso = await exigirNivel(parametros.telefono_operador, 'operador')
  if (!permiso.ok) return permiso.rechazo

  const pedidoId = parametros.pedido_id ?? (await ultimoPedidoDe(parametros.telefono_operador))
  if (!pedidoId) return noEncontrado('¿De qué pedido? Búscalo primero por el nombre del cliente.')

  const { data } = await supabaseAdmin()
    .from('pedido_items')
    .select('*')
    .eq('pedido_id', pedidoId)
    .eq('origen', 'declarado')
  const declarados = (data ?? []) as PedidoItem[]
  if (declarados.length === 0) return noEncontrado('Ese pedido no tiene prendas declaradas.')

  const conteos: { itemDeclaradoId: string; cantidadReal: number }[] = []
  const sinPareja: string[] = []
  for (const conteo of parametros.conteos) {
    const buscado = normalizar(conteo.descripcion)
    const item = declarados.find((d) => {
      const nombre = normalizar(d.descripcion)
      return nombre.includes(buscado) || buscado.includes(nombre)
    })
    if (item && !conteos.some((c) => c.itemDeclaradoId === item.id)) {
      conteos.push({ itemDeclaradoId: item.id, cantidadReal: conteo.cantidad })
    } else {
      sinPareja.push(conteo.descripcion)
    }
  }

  const faltan = declarados.filter((d) => !conteos.some((c) => c.itemDeclaradoId === d.id))
  if (sinPareja.length > 0 || faltan.length > 0) {
    return fallo(
      'PARAMETROS_INVALIDOS',
      [
        sinPareja.length ? `No reconozco en el pedido: ${sinPareja.join(', ')}.` : '',
        faltan.length
          ? `Falta contar: ${faltan.map((f) => `${f.descripcion} (declaradas ${Number(f.cantidad)})`).join(', ')}.`
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
  }

  const resultado = await verificarConteo(pedidoId, conteos, {
    actor: 'operador',
    motivo: firma(permiso.autorizado),
  })
  if (!resultado.ok) return fallo('PARAMETROS_INVALIDOS', resultado.error)

  await recordarUltimoPedido(parametros.telefono_operador, pedidoId)
  return exito({
    pedido_id: pedidoId,
    estado: resultado.datos.estado,
    hay_discrepancia: resultado.datos.hayDiscrepancia,
    diferencias: resultado.datos.diferencias,
    // Si hay diferencia, se resuelve en el CRM: aquí no se mueve dinero.
    siguiente_paso: resultado.datos.hayDiscrepancia
      ? 'Pedido congelado. El administrador avisa al cliente y cierra la discrepancia desde el CRM.'
      : 'Conteo correcto. El pedido pasa a en proceso.',
  })
}
