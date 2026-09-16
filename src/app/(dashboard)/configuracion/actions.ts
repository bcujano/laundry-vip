'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/auth'
import { normalizarTelefono } from '@/lib/telefono'
import { actualizar, agregarOperador, cambiarActivoOperador } from '@/server/configuracion/repo'

export type EstadoConfig = { error?: string; ok?: boolean }

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:MM.')

const esquema = z.object({
  nombre_negocio: z.string().min(1, 'El nombre del negocio es obligatorio.'),
  saludo_agente: z.string(),
  dias_operacion: z.array(z.coerce.number().int().min(1).max(7)).min(1, 'Elige al menos un día.'),
  hora_apertura: hora,
  hora_cierre: hora,
  hora_recoleccion_inicio: hora,
  hora_recoleccion_fin: hora,
  margen_minimo_minutos: z.coerce.number().int().min(0).max(720),
  tarifa_combo: z.coerce.number().min(0),
  limite_mensajes_diarios_por_telefono: z.coerce.number().int().min(1),
})

export async function guardarConfiguracion(
  _previo: EstadoConfig,
  datos: FormData,
): Promise<EstadoConfig> {
  if (!(await exigirPermiso('configuracion'))) {
    return { error: 'No tienes permiso para cambiar la configuración.' }
  }

  const analisis = esquema.safeParse({
    ...Object.fromEntries(datos),
    dias_operacion: datos.getAll('dias_operacion'),
  })
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }
  }

  const valores = analisis.data
  if (valores.hora_recoleccion_fin <= valores.hora_recoleccion_inicio) {
    return { error: 'La recolección debe cerrar después de abrir.' }
  }
  if (
    valores.margen_minimo_minutos >
    horasEnMinutos(valores.hora_recoleccion_fin) - horasEnMinutos(valores.hora_recoleccion_inicio)
  ) {
    return { error: 'El margen no cabe dentro de la ventana de recolección.' }
  }

  const resultado = await actualizar(valores)
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/configuracion')
  return { ok: true }
}

function horasEnMinutos(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

export async function agregarOperadorWhitelist(
  _previo: EstadoConfig,
  datos: FormData,
): Promise<EstadoConfig> {
  if (!(await exigirPermiso('configuracion'))) {
    return { error: 'No tienes permiso para cambiar la lista blanca.' }
  }

  const nombre = String(datos.get('nombre') ?? '').trim()
  const crudo = String(datos.get('telefono') ?? '')
  if (nombre === '') return { error: 'El nombre es obligatorio.' }

  // Lo que escriba el dueño se normaliza; no se le pide formato internacional.
  const telefono = normalizarTelefono(crudo)
  if (!telefono) return { error: `"${crudo}" no parece un número de teléfono.` }

  const resultado = await agregarOperador(telefono, nombre)
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/configuracion')
  return { ok: true }
}

export async function alternarOperador(id: string, activo: boolean): Promise<EstadoConfig> {
  if (!(await exigirPermiso('configuracion'))) {
    return { error: 'No tienes permiso para cambiar la lista blanca.' }
  }
  const resultado = await cambiarActivoOperador(id, activo)
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/configuracion')
  return { ok: true }
}
