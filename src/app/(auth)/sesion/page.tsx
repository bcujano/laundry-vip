'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/browser'

/**
 * Puente para el flujo implícito. El token viaja en el fragmento de la URL,
 * que el servidor nunca ve; aquí se lee desde el navegador y se convierte en
 * una sesión con cookies, que es lo que el resto del CRM entiende.
 */
export default function Sesion() {
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    const fragmento = new URLSearchParams(window.location.hash.slice(1))
    const access_token = fragmento.get('access_token')
    const refresh_token = fragmento.get('refresh_token')

    if (!access_token || !refresh_token) {
      window.location.replace('/login?error=enlace_invalido')
      return
    }

    supabaseBrowser()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setFallo(true)
          return
        }
        window.location.replace('/')
      })
      .catch(() => setFallo(true))
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <p className="text-sm" role="status">
        {fallo
          ? 'El enlace ya no es válido. Pide uno nuevo desde el inicio de sesión.'
          : 'Entrando…'}
      </p>
    </main>
  )
}
