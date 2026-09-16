'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'

const esquema = z.object({
  email: z.email('Escribe un correo válido.'),
})

export type EstadoLogin = { error?: string; enviado?: boolean }

/**
 * Envía el enlace mágico. No revela si el correo existe o no: el mensaje de
 * éxito es el mismo en ambos casos, para no confirmar cuentas a un extraño.
 * Las cuentas se crean a mano; no hay autoregistro.
 */
export async function enviarEnlace(_previo: EstadoLogin, datos: FormData): Promise<EstadoLogin> {
  const analisis = esquema.safeParse({ email: datos.get('email') })
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? 'Correo inválido.' }
  }

  // El destino del enlace sale de la petición, no de una variable de entorno:
  // así funciona igual en local y en el dominio de producción.
  const cabeceras = await headers()
  const host = cabeceras.get('x-forwarded-host') ?? cabeceras.get('host') ?? 'localhost:3000'
  const protocolo = host.startsWith('localhost') ? 'http' : 'https'

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.signInWithOtp({
    email: analisis.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${protocolo}://${host}/callback`,
    },
  })

  if (error && error.status !== 400) {
    return { error: 'No se pudo enviar el enlace. Intenta de nuevo.' }
  }

  return { enviado: true }
}
