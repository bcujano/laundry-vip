import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ParametrosVentana } from '@/server/scheduling/ventana'
import type { Configuracion, NivelOperador, OperadorWhitelist } from '@/types/database'

export type ResultadoEscritura = { ok: true } | { ok: false; error: string }

/** La configuración es una fila única; si no existe, la base está sin sembrar. */
export async function obtener(): Promise<Configuracion> {
  const { data, error } = await supabaseAdmin()
    .from('configuracion')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) throw new Error(`No se pudo leer la configuración: ${error.message}`)
  if (!data) throw new Error('No hay fila de configuración. Corre pnpm db:seed.')
  return data as Configuracion
}

/** Los parámetros que necesita el cálculo de ventanas, ya en su forma. */
export async function parametrosVentana(): Promise<ParametrosVentana> {
  const config = await obtener()
  return {
    diasOperacion: config.dias_operacion,
    horaInicio: config.hora_recoleccion_inicio,
    horaFin: config.hora_recoleccion_fin,
    margenMinutos: config.margen_minimo_minutos,
  }
}

export type CambiosConfiguracion = Partial<
  Pick<
    Configuracion,
    | 'nombre_negocio'
    | 'saludo_agente'
    | 'dias_operacion'
    | 'hora_recoleccion_inicio'
    | 'hora_recoleccion_fin'
    | 'hora_apertura'
    | 'hora_cierre'
    | 'hora_cierre_sabado'
    | 'radio_cobertura_km'
    | 'sectores_cobertura'
    | 'seguimiento_modo'
    | 'direccion_local'
    | 'telefono_local'
    | 'enlace_mapa'
    | 'margen_minimo_minutos'
    | 'tarifa_recoleccion_entrega'
    | 'horas_entrega_min'
    | 'horas_entrega_max'
    | 'limite_mensajes_diarios_por_telefono'
    | 'limite_costo_diario_openai_usd'
  >
>

export async function actualizar(cambios: CambiosConfiguracion): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin().from('configuracion').update(cambios).eq('id', 1)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function listarWhitelist(): Promise<OperadorWhitelist[]> {
  const { data, error } = await supabaseAdmin()
    .from('operador_whitelist')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) throw new Error(`No se pudo leer la lista blanca: ${error.message}`)
  return (data ?? []) as OperadorWhitelist[]
}

/** El teléfono entra ya normalizado a E.164; la base además lo verifica. */
export async function agregarOperador(
  telefono: string,
  nombre: string,
  nivel: NivelOperador = 'operador',
): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin()
    .from('operador_whitelist')
    .upsert({ telefono, nombre, nivel, activo: true }, { onConflict: 'telefono' })

  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function cambiarActivoOperador(
  id: string,
  activo: boolean,
): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin().from('operador_whitelist').update({ activo }).eq('id', id)

  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Sube o baja de nivel: admin pide reportes; operador solo trabaja en planta. */
export async function cambiarNivelOperador(
  id: string,
  nivel: NivelOperador,
): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin().from('operador_whitelist').update({ nivel }).eq('id', id)

  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Quita un número de la lista blanca: desde ese momento el agente lo trata como cliente. */
export async function eliminarOperador(id: string): Promise<ResultadoEscritura> {
  const { error } = await supabaseAdmin().from('operador_whitelist').delete().eq('id', id)

  return error ? { ok: false, error: error.message } : { ok: true }
}

/** ¿Este número pertenece a un operador habilitado? Lo usa el agente. */
export async function esOperadorActivo(telefono: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('operador_whitelist')
    .select('id')
    .eq('telefono', telefono)
    .eq('activo', true)
    .maybeSingle()

  if (error) throw new Error(`No se pudo consultar la lista blanca: ${error.message}`)
  return data !== null
}
