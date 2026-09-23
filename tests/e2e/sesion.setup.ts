import { expect, test as preparar } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { BASE_URL, ESTADO_SESION } from '../../playwright.config.ts'

/**
 * Inicia sesión de verdad, sin contraseña de por medio ni cuentas de prueba en
 * producción: con la llave de servicio se emite un enlace de un solo uso y se
 * canjea con `@supabase/ssr`, la MISMA librería que usa el CRM. Las cookies
 * que ella produce son, por construcción, las que la app espera leer.
 *
 * El login anterior seguía una ruta `/callback` que ya no existe: el CRM pasó
 * a correo y contraseña y esta preparación se quedó atrás. Por eso los E2E
 * nunca habían corrido.
 */
preparar('preparar la sesión del superadmin', async ({ page }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false },
  }).auth.admin

  const { data, error } = await admin.generateLink({
    type: 'magiclink',
    email: process.env.E2E_EMAIL ?? 'brncjn@gmail.com',
  })
  if (error) throw new Error(`No se pudo generar el enlace: ${error.message}`)

  const capturadas: { name: string; value: string }[] = []
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => [],
      setAll: (nuevas) => {
        for (const { name, value } of nuevas) capturadas.push({ name, value })
      },
    },
  })

  const canje = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  })
  if (canje.error) throw new Error(`No se pudo canjear el enlace: ${canje.error.message}`)
  if (capturadas.length === 0) throw new Error('El canje no dejó cookies de sesión.')

  const { hostname, protocol } = new URL(BASE_URL)
  await page.context().addCookies(
    capturadas.map((cookie) => ({
      ...cookie,
      domain: hostname,
      path: '/',
      httpOnly: false,
      secure: protocol === 'https:',
      sameSite: 'Lax' as const,
    })),
  )

  // Si la sesión sirve, el panel muestra la Cola de hoy.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Cola de hoy' })).toBeVisible()

  await page.context().storageState({ path: ESTADO_SESION })
})
