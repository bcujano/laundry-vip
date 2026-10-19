'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/auth'
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
  if (!(await exigirPermiso('clientes'))) return { error: 'No tienes permiso para esto.' }
  const analisis = z.object({ id: z.uuid(), estado: z.enum(ESTADOS) }).safeParse({ id, estado })
  if (!analisis.success) return { error: 'Datos inválidos.' }

  const resultado = await cambiarEstado(analisis.data.id, analisis.data.estado, 'llamada')
  if (!resultado.ok) return { error: resultado.error }
  revalidatePath('/prospectos')
  return { ok: true }
}

export async function guardarNotasProspecto(
  _previo: EstadoProspectoAccion,
  datos: FormData,
): Promise<EstadoProspectoAccion> {
  if (!(await exigirPermiso('clientes'))) return { error: 'No tienes permiso para esto.' }
  const analisis = z
    .object({ id: z.uuid(), notas: z.string().max(1000, 'Máximo 1000 caracteres.') })
    .safeParse({ id: datos.get('id'), notas: String(datos.get('notas') ?? '') })
  if (!analisis.success) return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }

  const resultado = await guardarNotas(analisis.data.id, analisis.data.notas)
  if (!resultado.ok) return { error: resultado.error }
  revalidatePath('/prospectos')
  return { ok: true, aviso: 'Guardado' }
}
