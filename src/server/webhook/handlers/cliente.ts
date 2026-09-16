import { supabaseAdmin } from '@/lib/supabase/admin'
import { parametrosVentana } from '@/server/configuracion/repo'
import { calcularVehiculo, cotizarPrendas, ErrorCotizacion } from '@/server/pricing/cotizar'
import { obtenerProximaVentana, ultimaHoraDelDia } from '@/server/scheduling/ventana'
import type { Cliente, Conversacion } from '@/types/database'
import { exito, fallo, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'

/**
 * Acciones del modo cliente. Ninguna calcula precios por su cuenta: todas
 * pasan por server/pricing/cotizar.ts, que es la fuente única de verdad.
 */

/**
 * Idempotencia. Si el mismo mensaje de Chatwoot llega dos veces (porque n8n
 * reintentó), la segunda se reconoce como ya procesada y no se vuelve a actuar.
 */
export async function registrarEventoEntrante(
  parametros: ParametrosDe<'registrar_evento_entrante'>,
): Promise<ResultadoAccion<{ ya_procesado: boolean }>> {
  const { error } = await supabaseAdmin()
    .from('eventos_procesados')
    .insert({
      dedupe_key: parametros.dedupe_key,
      tipo: parametros.tipo,
      payload: parametros.payload ?? null,
    })

  // 23505 = unique_violation: esta clave ya entró antes.
  if (error?.code === '23505') return exito({ ya_procesado: true })
  if (error) return fallo('ERROR_INTERNO', error.message, 500)

  return exito({ ya_procesado: false })
}

/** Memoria de la conversación: lo que el agente sabe de este teléfono. */
export async function sincronizarMemoria(
  parametros: ParametrosDe<'sincronizar_memoria_conversacion'>,
): Promise<
  ResultadoAccion<{ contexto: Record<string, unknown>; chatwoot_conversation_id: number | null }>
> {
  const cliente = supabaseAdmin()

  const { data: existente } = await cliente
    .from('conversaciones')
    .select('*')
    .eq('telefono', parametros.telefono)
    .maybeSingle()

  const previo = (existente as Conversacion | null)?.contexto ?? {}
  const contexto = parametros.contexto ? { ...previo, ...parametros.contexto } : previo

  const { data, error } = await cliente
    .from('conversaciones')
    .upsert(
      {
        telefono: parametros.telefono,
        contexto,
        chatwoot_conversation_id:
          parametros.chatwoot_conversation_id ??
          (existente as Conversacion | null)?.chatwoot_conversation_id ??
          null,
        ultima_interaccion: new Date().toISOString(),
      },
      { onConflict: 'telefono' },
    )
    .select('*')
    .single()

  if (error) return fallo('ERROR_INTERNO', error.message, 500)

  const fila = data as Conversacion
  return exito({
    contexto: fila.contexto,
    chatwoot_conversation_id: fila.chatwoot_conversation_id,
  })
}

/** ¿Este número puede hablarle al agente en modo operador? */
export async function verificarWhitelistOperador(
  parametros: ParametrosDe<'verificar_whitelist_operador'>,
): Promise<ResultadoAccion<{ es_operador: boolean; nombre: string | null }>> {
  const { data, error } = await supabaseAdmin()
    .from('operador_whitelist')
    .select('nombre')
    .eq('telefono', parametros.telefono)
    .eq('activo', true)
    .maybeSingle()

  if (error) return fallo('ERROR_INTERNO', error.message, 500)
  return exito({ es_operador: data !== null, nombre: data?.nombre ?? null })
}

export async function findOrCreateClient(
  parametros: ParametrosDe<'find_or_create_client'>,
): Promise<
  ResultadoAccion<{ cliente: Cliente; creado: boolean; debe_enviar_aviso_privacidad: boolean }>
> {
  const cliente = supabaseAdmin()

  const { data: existente, error: errorLectura } = await cliente
    .from('clientes')
    .select('*')
    .eq('telefono', parametros.telefono)
    .maybeSingle()

  if (errorLectura) return fallo('ERROR_INTERNO', errorLectura.message, 500)

  if (existente) {
    const fila = existente as Cliente
    return exito({
      cliente: fila,
      creado: false,
      // El aviso de privacidad se manda una sola vez por cliente (LOPDP).
      debe_enviar_aviso_privacidad: fila.aviso_privacidad_enviado_en === null,
    })
  }

  const { data, error } = await cliente
    .from('clientes')
    .insert({
      telefono: parametros.telefono,
      nombre_contacto: parametros.nombre_contacto ?? null,
      nombre_negocio: parametros.nombre_negocio ?? null,
      tipo_negocio: parametros.tipo_negocio ?? 'particular',
      canal_origen: parametros.canal_origen ?? 'whatsapp_agente',
    })
    .select('*')
    .single()

  if (error) return fallo('ERROR_INTERNO', error.message, 500)

  return exito({ cliente: data as Cliente, creado: true, debe_enviar_aviso_privacidad: true })
}

export async function cotizar(
  parametros: ParametrosDe<'cotizar_prendas'>,
): Promise<ResultadoAccion<Awaited<ReturnType<typeof cotizarPrendas>>>> {
  try {
    return exito(await cotizarPrendas(parametros.items))
  } catch (error) {
    if (error instanceof ErrorCotizacion) return fallo(error.codigo, error.message, 400)
    throw error
  }
}

export function vehiculo(
  parametros: ParametrosDe<'calcular_vehiculo'>,
): ResultadoAccion<{ vehiculo: 'moto' | 'auto'; numero_fundas: number }> {
  try {
    return exito({
      vehiculo: calcularVehiculo(parametros.numero_fundas),
      numero_fundas: parametros.numero_fundas,
    })
  } catch (error) {
    if (error instanceof ErrorCotizacion) return fallo(error.codigo, error.message, 400)
    throw error
  }
}

/** El agente nunca rechaza por horario: siempre ofrece la siguiente ventana. */
export async function proximaVentana(parametros: ParametrosDe<'obtener_proxima_ventana'>): Promise<
  ResultadoAccion<{
    inicio: string
    fin: string
    es_hoy: boolean
    ultima_hora_del_dia: string
  }>
> {
  const config = await parametrosVentana()
  const desde = parametros?.desde ? new Date(parametros.desde) : new Date()

  if (Number.isNaN(desde.getTime())) {
    return fallo('PARAMETROS_INVALIDOS', 'La fecha "desde" no es válida.')
  }

  const ventana = obtenerProximaVentana(desde, config)
  return exito({
    inicio: ventana.inicio.toISOString(),
    fin: ventana.fin.toISOString(),
    es_hoy: ventana.esHoy,
    ultima_hora_del_dia: ultimaHoraDelDia(config),
  })
}
