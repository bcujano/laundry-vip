'use server'

import { revalidatePath } from 'next/cache'
import { exigirPermiso } from '@/lib/auth'
import { actualizar } from '@/server/configuracion/repo'

export type EstadoPlantillas = { error?: string; ok?: boolean }

/** Enciende o apaga los mensajes automáticos por plantilla (reactivación y ropa no retirada). */
export async function cambiarPlantillasAutomaticas(activas: boolean): Promise<EstadoPlantillas> {
  if (!(await exigirPermiso('configuracion'))) {
    return { error: 'No tienes permiso para cambiar los mensajes automáticos.' }
  }
  const resultado = await actualizar({ plantillas_automaticas: activas })
  if (!resultado.ok) return { error: resultado.error }
  revalidatePath('/configuracion')
  return { ok: true }
}
