import { supabaseAdmin } from '@/lib/supabase/admin'
import { horarioLegible } from '@/server/configuracion/horario'
import { datosDelLocal } from '@/server/configuracion/local'
import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import { cotizarPrendas, ErrorCotizacion } from '@/server/pricing/cotizar'
import type { Cliente, Conversacion } from '@/types/database'
import { type ResultadoUso, registrarUso, usoDeHoy } from '../cost-tracking'
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
): Promise<
  ResultadoAccion<{
    ya_procesado: boolean
    /** El gasto de hoy ya pasó el techo: n8n deja de contestar hasta mañana. */
    costo_excedido: boolean
    alerta_costo?: ResultadoUso
  }>
> {
  const { error } = await supabaseAdmin()
    .from('eventos_procesados')
    .insert({
      dedupe_key: parametros.dedupe_key,
      tipo: parametros.tipo,
      payload: parametros.payload ?? null,
    })

  // 23505 = unique_violation: esta clave ya entró antes.
  const yaProcesado = error?.code === '23505'
  if (error && !yaProcesado) return fallo('ERROR_INTERNO', error.message, 500)

  // El gasto se acumula aunque el mensaje sea repetido: el turno ya se pagó.
  const uso = parametros.uso_openai
    ? await registrarUso(parametros.uso_openai.tokens, parametros.uso_openai.costo_estimado_usd)
    : undefined

  const hoy = uso ?? (await usoDeHoy())

  return exito({
    ya_procesado: yaProcesado,
    costo_excedido: hoy.costo_dia_usd > hoy.limite_usd,
    ...(uso?.debe_alertar ? { alerta_costo: uso } : {}),
  })
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

/**
 * ¿Este número puede hablarle al agente en modo operador?
 *
 * n8n llama esto en CADA mensaje entrante, antes de los dos agentes, así que
 * también devuelve cómo se llama el negocio: el prompt lo lee de aquí y nunca
 * lleva el nombre escrito. Si el dueño lo cambia en Configuración, el agente
 * se presenta distinto en el siguiente mensaje.
 */
export async function verificarWhitelistOperador(
  parametros: ParametrosDe<'verificar_whitelist_operador'>,
): Promise<
  ResultadoAccion<{
    es_operador: boolean
    nombre: string | null
    nivel: string | null
    negocio: {
      nombre: string
      saludo: string
      cobertura: string
      horario: string
    }
  }>
> {
  const [{ data, error }, negocio] = await Promise.all([
    supabaseAdmin()
      .from('operador_whitelist')
      .select('nombre, nivel')
      .eq('telefono', parametros.telefono)
      .eq('activo', true)
      .maybeSingle(),
    obtenerConfig(),
  ])

  if (error) return fallo('ERROR_INTERNO', error.message, 500)

  // n8n verifica cada mensaje entrante: es el momento de anotar que este número
  // escribió, para saber si el resumen de las 8:00 cae dentro de las 24 h de Meta.
  if (data) {
    await supabaseAdmin()
      .from('operador_whitelist')
      .update({ ultimo_mensaje_en: new Date().toISOString() })
      .eq('telefono', parametros.telefono)
  }

  return exito({
    es_operador: data !== null,
    nombre: data?.nombre ?? null,
    nivel: data?.nivel ?? null,
    negocio: {
      nombre: negocio.nombre_negocio,
      saludo: negocio.saludo_agente,
      cobertura: `${Number(negocio.radio_cobertura_km).toString().replace('.', ',')} km a la redonda del local`,
      horario: horarioLegible(negocio),
      ...datosDelLocal(negocio),
    },
  })
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
    let fila = existente as Cliente

    // Lo que el agente aprende solo rellena huecos: nunca pisa lo que el equipo
    // escribió en el CRM. El nombre que dice el propio cliente sí manda sobre
    // el del perfil de WhatsApp y sobre uno anterior que él mismo haya dado:
    // si se corrige («Juan Carlos, no Juan»), el CRM se corrige con él.
    const huecos: Partial<Cliente> = {}
    const whatsapp = parametros.nombre_whatsapp?.trim()
    const dicho = parametros.nombre_contacto?.trim()
    if (dicho && dicho !== fila.nombre_contacto && fila.nombre_contacto_origen !== 'crm') {
      huecos.nombre_contacto = dicho
      huecos.nombre_contacto_origen = 'cliente'
    } else if (!fila.nombre_contacto && whatsapp) {
      huecos.nombre_contacto = whatsapp
      huecos.nombre_contacto_origen = 'whatsapp'
    }
    if (!fila.nombre_negocio && parametros.nombre_negocio?.trim()) {
      huecos.nombre_negocio = parametros.nombre_negocio.trim()
    }
    if (
      fila.tipo_negocio === 'particular' &&
      parametros.tipo_negocio &&
      parametros.tipo_negocio !== 'particular'
    ) {
      huecos.tipo_negocio = parametros.tipo_negocio
    }

    if (Object.keys(huecos).length > 0) {
      const { data, error } = await cliente
        .from('clientes')
        .update(huecos)
        .eq('id', fila.id)
        .select('*')
        .single()
      if (error) return fallo('ERROR_INTERNO', error.message, 500)
      fila = data as Cliente
    }

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
      nombre_contacto:
        parametros.nombre_contacto?.trim() || parametros.nombre_whatsapp?.trim() || null,
      // El nombre del perfil es provisional; el que diga el cliente lo reemplaza.
      nombre_contacto_origen: parametros.nombre_contacto?.trim() ? 'cliente' : 'whatsapp',
      nombre_negocio: parametros.nombre_negocio?.trim() || null,
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
