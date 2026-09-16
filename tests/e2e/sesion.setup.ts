import { expect, test as preparar } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { ESTADO_SESION } from '../../playwright.config.ts'

/**
 * Inicia sesión de verdad, sin correo de por medio.
 * Se genera un enlace mágico con la llave de servicio y se sigue: es el mismo
 * camino que recorre una persona, solo que sin esperar el correo.
 */
preparar('preparar la sesión del superadmin', async ({ page }) => {
  const admin = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  ).auth.admin

  const { data, error } = await admin.generateLink({
    type: 'magiclink',
    email: process.env.E2E_EMAIL ?? 'brncjn@gmail.com',
  })
  if (error) throw new Error(`No se pudo generar el enlace: ${error.message}`)

  const tokenHash = data.properties.hashed_token
  await page.goto(`/callback?token_hash=${tokenHash}&type=magiclink`)

  // Si el login funcionó, el panel muestra la Cola de hoy.
  await expect(page.getByRole('heading', { name: 'Cola de hoy' })).toBeVisible()

  await page.context().storageState({ path: ESTADO_SESION })
})
