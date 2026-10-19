'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/auth'
import { actualizar } from '@/server/configuracion/repo'

export type EstadoProspeccion = { error?: string; aviso?: string; ok?: boolean }

/**
 * Enciende o apaga la prospección automática: el primer mensaje por plantilla a negocios que nunca
 * han escrito. Es solo del superadmin (área «configuracion») y arranca apagada.
 */
export async function cambiarProspeccion(activa: boolean): Promise<EstadoProspeccion> {
  if (!(await exigirPermiso('configuracion'))) {
    return { error: 'No tienes permiso para cambiar la prospección automática.' }
  }
  const resultado = await actualizar({ prospeccion_automatica: activa })
  if (!resultado.ok) return { error: resultado.error }
  revalidatePath('/configuracion')
  return { ok: true }
}

const esquemaLimite = z.object({
  limite: z.coerce
    .number()
    .int('Debe ser un número entero.')
    .min(1, 'Mínimo 1 por día.')
    .max(50, 'Máximo 50 por día: más que eso se parece a spam y Meta lo castiga.'),
})

export async function guardarLimiteProspeccion(
  _previo: EstadoProspeccion,
  datos: FormData,
): Promise<EstadoProspeccion> {
  if (!(await exigirPermiso('configuracion'))) {
    return { error: 'No tienes permiso para cambiar la prospección automática.' }
  }
  const analisis = esquemaLimite.safeParse({ limite: datos.get('limite') })
  if (!analisis.success) return { error: analisis.error.issues[0]?.message ?? 'Datos inválidos.' }

  const resultado = await actualizar({ prospeccion_limite_diario: analisis.data.limite })
  if (!resultado.ok) return { error: resultado.error }
  revalidatePath('/configuracion')
  return { ok: true, aviso: 'Guardado.' }
}
