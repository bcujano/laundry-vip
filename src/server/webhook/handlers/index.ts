import { fallo, type ResultadoAccion } from '../respuesta'
import { type Accion, parametrosPorAccion } from '../schemas'
import { consultaAdmin, resumenDiario } from './admin'
import {
  cotizar,
  findOrCreateClient,
  proximaVentana,
  registrarEventoEntrante,
  sincronizarMemoria,
  vehiculo,
  verificarWhitelistOperador,
} from './cliente'
import { actualizarRegistro, registrarClientePresencial } from './operador'
import { consultarEstadoPorTelefono, consultarPedidoPorId, crear } from './pedidos'
import { avanzarEstadoPlanta, buscarPedidos, registrarConteo } from './planta'
import { generarReporte } from './reportes'

/**
 * Registro de acciones. Añadir una acción es añadir su schema y su entrada
 * aquí; el route.ts no cambia nunca.
 */
type Manejador = (parametros: never) => ResultadoAccion<unknown> | Promise<ResultadoAccion<unknown>>

const MANEJADORES: Record<Accion, Manejador> = {
  registrar_evento_entrante: registrarEventoEntrante,
  sincronizar_memoria_conversacion: sincronizarMemoria,
  verificar_whitelist_operador: verificarWhitelistOperador,
  find_or_create_client: findOrCreateClient,
  cotizar_prendas: cotizar,
  calcular_vehiculo: vehiculo,
  obtener_proxima_ventana: proximaVentana,
  crear_pedido: crear,
  consultar_estado_pedido: consultarEstadoPorTelefono,
  registrar_cliente_presencial: registrarClientePresencial,
  actualizar_registro: actualizarRegistro,
  buscar_pedidos: buscarPedidos,
  avanzar_estado: avanzarEstadoPlanta,
  registrar_conteo: registrarConteo,
  consulta_admin: consultaAdmin,
  resumen_diario: resumenDiario,
  generar_reporte: generarReporte,
  consultar_pedido: consultarPedidoPorId,
}

export async function despachar(
  accion: Accion,
  parametrosCrudos: unknown,
): Promise<ResultadoAccion<unknown>> {
  const esquema = parametrosPorAccion[accion]
  const analisis = esquema.safeParse(parametrosCrudos)

  if (!analisis.success) {
    const problema = analisis.error.issues[0]
    const campo = problema?.path.join('.')
    const detalle = campo ? `${campo}: ${problema?.message}` : (problema?.message ?? 'inválidos')
    return fallo('PARAMETROS_INVALIDOS', `Parámetros inválidos para "${accion}" (${detalle}).`)
  }

  const manejador = MANEJADORES[accion]
  return await manejador(analisis.data as never)
}
