'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/auth'
import { registrarContacto } from '@/server/prospectos/bitacora'
import { cambiarEstado, guardarNotas } from '@/server/prospectos/repo'

export type EstadoProspectoAccion = { error?: string; aviso?: string; ok?: boolean }

const ESTADOS = ['nuevo', 'contactado', 'descartado', 'no_contactar'] as const

/**
 * Lo que hace el equipo a mano con un prospecto. «contactado» desde aquí es que alguien lo llamó o le
 * escribió por su cuenta: el envío automático queda fuera de su alcance (nunca le escribirá a un
 * prospecto que ya no esté «nuevo»).
 */
export async function marcarProspecto(
  id: string,
  estado: (typeof ESTADOS)[number],
): Promise<EstadoProspectoAccion> {
  const sesion = await exigirPermiso('clientes')
  if (!sesion) return { error: 'No tienes permiso para esto.' }
  const analisis = z.object({ id: z.uuid(), estado: z.enum(ESTADOS) }).safeParse({ id, estado })
  if (!analisis.success) return { error: 'Datos inválidos.' }

  const resultado = await cambiarEstado(
    analisis.data.id,
    analisis.data.estado,
    'llamada',
    sesion.staff.nombre_completo,
  )
  if (!resultado.ok) return { error: resultado.error }
  revalidatePath('/prospectos')
  return { ok: true }
}

export async function guardarNotasProspecto(
  _previo: EstadoProspectoAccion,
  datos: FormData,
): Promise<EstadoProspectoAccion> {
  const sesion = await exigirPermiso('clientes')
  if (!sesion) return { error: 'No tienes permiso para esto.' }
  const analisis = z
    .object({ id: z.uuid(), notas: z.string().max(1000, 'Máximo 1000 caracteres.') })
    .safeParse({ id: datos.get('id'), notas: String(datos.get('notas') ?? '') })
  if (!analisis.success) return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }

  const resultado = await guardarNotas(
    analisis.data.id,
    analisis.data.notas,
    sesion.staff.nombre_completo,
  )
  if (!resultado.ok) return { error: resultado.error }
  revalidatePath('/prospectos')
  return { ok: true, aviso: 'Guardado' }
}

const CANALES = ['whatsapp', 'llamada', 'instagram', 'email', 'otro'] as const
const TIPOS = ['primer_contacto', 'seguimiento', 'respuesta'] as const

/**
 * El equipo anota un contacto que hizo por su cuenta (llamada, mensaje, Instagram…). Si era el primero
 * de un prospecto «sin contactar», pasa a «contactado» y el envío automático ya no le escribe.
 */
export async function registrarContactoManual(
  _previo: EstadoProspectoAccion,
  datos: FormData,
): Promise<EstadoProspectoAccion> {
  const sesion = await exigirPermiso('clientes')
  if (!sesion) return { error: 'No tienes permiso para esto.' }
  const analisis = z
    .object({
      id: z.uuid(),
      tipo: z.enum(TIPOS),
      canal: z.enum(CANALES),
      resultado: z.string().trim().min(1, 'Cuenta qué pasó.').max(200, 'Máximo 200 caracteres.'),
    })
    .safeParse({
      id: datos.get('id'),
      tipo: datos.get('tipo'),
      canal: datos.get('canal'),
      resultado: String(datos.get('resultado') ?? ''),
    })
  if (!analisis.success) return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }

  const { id, tipo, canal, resultado } = analisis.data
  const autor = sesion.staff.nombre_completo
  if (tipo === 'primer_contacto') {
    // Marca «contactado» y deja su propia línea en la bitácora; la nota del resultado va aparte.
    const marcado = await cambiarEstado(
      id,
      'contactado',
      canal === 'llamada' ? 'llamada' : 'manual',
      autor,
      false,
    )
    if (!marcado.ok) return { error: marcado.error }
  }
  const nota = await registrarContacto({ prospectoId: id, tipo, canal, resultado, autor })
  if (!nota.ok) return { error: nota.error }
  revalidatePath('/prospectos')
  revalidatePath('/prospectos/historial')
  return { ok: true, aviso: 'Registrado' }
}
