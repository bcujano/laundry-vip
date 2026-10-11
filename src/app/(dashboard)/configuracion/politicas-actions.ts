'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirPermiso } from '@/lib/auth'
import { guardarPolitica } from '@/server/configuracion/politicas'

export type EstadoPolitica = { error?: string; ok?: boolean }

const esquema = z.object({
  regla: z.string().trim().max(1500, 'La regla es demasiado larga (máximo 1.500 caracteres).'),
  quien_decide: z.enum(['agente', 'equipo', 'duena']),
  plazo_respuesta: z.string().trim().max(120),
  frase_guia: z.string().trim().max(500, 'La frase guía es demasiado larga (máximo 500).'),
})

/** Sol edita lo que el agente responde sobre un tema de criterio, sin pedirnos nada. */
export async function guardarPoliticaAccion(
  id: string,
  _previo: EstadoPolitica,
  datos: FormData,
): Promise<EstadoPolitica> {
  if (!(await exigirPermiso('configuracion'))) {
    return { error: 'No tienes permiso para cambiar las políticas.' }
  }

  const analisis = esquema.safeParse({
    regla: datos.get('regla') ?? '',
    quien_decide: datos.get('quien_decide'),
    plazo_respuesta: datos.get('plazo_respuesta') ?? '',
    frase_guia: datos.get('frase_guia') ?? '',
  })
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Revisa los campos.' }
  }

  const resultado = await guardarPolitica(id, {
    ...analisis.data,
    activa: datos.get('activa') === 'on',
  })
  if (!resultado.ok) return { error: resultado.error }

  revalidatePath('/configuracion')
  return { ok: true }
}
