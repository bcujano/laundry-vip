import { expect, test } from '@playwright/test'

test.describe('sin sesión', () => {
  test('el panel manda al login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Lavandería VIP' })).toBeVisible()
  })

  test('cualquier pantalla interna también manda al login', async ({ page }) => {
    for (const ruta of ['/pedidos', '/clientes', '/servicios', '/configuracion', '/reportes']) {
      await page.goto(ruta)
      await expect(page, `${ruta} deberia redirigir`).toHaveURL(/\/login$/)
    }
  })

  test('el healthcheck responde con las cabeceras de seguridad', async ({ request }) => {
    const respuesta = await request.get('/api/health')

    expect(respuesta.status()).toBe(200)
    expect((await respuesta.json()).ok).toBe(true)
    expect(respuesta.headers()['x-content-type-options']).toBe('nosniff')
    expect(respuesta.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('el webhook rechaza a quien no trae el secreto', async ({ request }) => {
    const respuesta = await request.post('/api/webhook', {
      data: { accion: 'calcular_vehiculo', parametros: { numero_fundas: 1 } },
    })
    expect(respuesta.status()).toBe(401)
  })
})
