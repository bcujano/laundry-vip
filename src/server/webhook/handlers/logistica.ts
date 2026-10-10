import { horarioLegible } from '@/server/configuracion/horario'
import { datosDelLocal } from '@/server/configuracion/local'
import { obtener as obtenerConfig, parametrosVentana } from '@/server/configuracion/repo'
import { evaluarCobertura } from '@/server/pedidos/cobertura-geo'
import { geocodificar } from '@/server/pedidos/geocodificar'
import { calcularVehiculo } from '@/server/pricing/cotizar'
import { limitesDelDia, obtenerProximaVentana, ultimaHoraDelDia } from '@/server/scheduling/ventana'
import { plazosHabituales } from '@/server/servicios/repo'
import { exito, fallo, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/**
 * Cuándo se recoge y en qué vehículo. Todo lo que el agente promete sobre
 * horarios, tarifa, cobertura y plazos sale de Configuración: el prompt no
 * lleva ni una cifra.
 */

export function vehiculo(
  parametros: ParametrosDe<'calcular_vehiculo'>,
): ResultadoAccion<{ vehiculo: 'auto'; numero_fundas: number | null }> {
  return exito({
    vehiculo: calcularVehiculo(parametros?.numero_fundas),
    numero_fundas: parametros?.numero_fundas ?? null,
  })
}

/**
 * Desde cuándo buscar la ventana. El cliente pide «para mañana» y el modelo
 * manda la fecha suelta («2026-10-01»), el ISO completo o cadena vacía.
 * Una fecha suelta es la medianoche de Quito de ese día, no la de Londres.
 */
function interpretarDesde(crudo: string | undefined): Date | null {
  const texto = (crudo ?? '').trim()
  if (texto === '') return new Date()

  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(texto)
  const fecha = new Date(soloFecha ? `${texto}T05:00:00.000Z` : texto)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

/** El agente nunca rechaza por horario: siempre ofrece la siguiente ventana. */
export async function proximaVentana(parametros: ParametrosDe<'obtener_proxima_ventana'>): Promise<
  ResultadoAccion<{
    inicio: string
    fin: string
    es_hoy: boolean
    ultima_hora_del_dia: string
    hora_apertura: string
    hora_cierre: string
    horario: string
    tarifa_recoleccion_entrega: number
    /** Plazo habitual por método (agua, seco…), ya escrito: «24 horas», «72 horas». */
    plazos_por_metodo: Record<string, string>
  }>
> {
  // Horario y tarifa salen de Configuración: el dueño los cambia en el CRM y el
  // agente no puede tener un valor escrito a mano en su prompt.
  const [config, negocio, plazos] = await Promise.all([
    parametrosVentana(),
    obtenerConfig(),
    plazosHabituales(),
  ])
  const desde = interpretarDesde(parametros?.desde)

  if (desde === null) {
    return fallo('PARAMETROS_INVALIDOS', 'La fecha "desde" no es válida.')
  }

  const ventana = obtenerProximaVentana(desde, config)

  // «Hoy» es hoy de verdad, no el día que pidió el cliente: si pregunta por el
  // viernes, la ventana del viernes NO es hoy. El agente llegó a confirmar
  // «hoy» una recogida que había acordado para mañana.
  const hoy = limitesDelDia(new Date())
  const esHoyDeVerdad = ventana.inicio >= hoy.desde && ventana.inicio < hoy.hasta

  return exito({
    inicio: ventana.inicio.toISOString(),
    fin: ventana.fin.toISOString(),
    es_hoy: esHoyDeVerdad,
    ultima_hora_del_dia: ultimaHoraDelDia(config),
    hora_apertura: negocio.hora_apertura.slice(0, 5),
    hora_cierre: negocio.hora_cierre.slice(0, 5),
    // Ya escritos para decírselos al cliente tal cual, sin que el agente los arme.
    horario: horarioLegible(negocio),
    ...datosDelLocal(negocio),
    // OJO: aquí NO va el radio. Al cliente no se le dice «a 2,5 km a la redonda»: se verifica
    // por dentro con verificar_cobertura y se le dice solo si se puede o no.
    tarifa_recoleccion_entrega: Number(negocio.tarifa_recoleccion_entrega),
    // El plazo sale de cada servicio en el CRM (María Sol, 2026-10): agua 24 h, seco 72 h…
    // Con una cotización a la vista, el plazo exacto viene en `cotizar_prendas`.
    plazos_por_metodo: plazos,
  })
}

/**
 * ¿Se recoge en el barrio o sector que dijo el cliente? El agente solo recibe sí o no:
 * el radio y la lista de sectores son cosa interna. `cubre: null` = la lista no está
 * cargada y no se puede verificar (el agente sigue como antes, sin prometer ni negar).
 */
export async function verificarCobertura(
  parametros: ParametrosDe<'verificar_cobertura'>,
): Promise<ResultadoAccion<{ cubre: boolean | null }>> {
  const config = await obtenerConfig()
  const veredicto = await evaluarCobertura(
    { sector: parametros.sector, direccion: parametros.direccion },
    config,
    (texto) => geocodificar(texto),
  )
  if (veredicto.estado === 'falta_sector') {
    return fallo('PARAMETROS_INVALIDOS', 'No se entiende el sector. Pídele el barrio al cliente.')
  }
  return exito({
    cubre: veredicto.estado === 'sin_verificar' ? null : veredicto.estado === 'dentro',
  })
}
