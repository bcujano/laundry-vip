import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { corrida } from '../util/corrida.ts'

/**
 * Camino de humo completo, con sesión real: el operador entra, ve la cola,
 * abre un pedido, confirma un pago y la pantalla se actualiza sin recargar.
 */

const CORRIDA = corrida()
const TELEFONO = `+5939${CORRIDA}77`

function admin() {
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  )
}

let clienteId = ''
let pedidoId = ''

test.beforeAll(async () => {
  const supabase = admin()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .insert({
      telefono: TELEFONO,
      nombre_negocio: `Hotel E2E ${CORRIDA}`,
      tipo_negocio: 'hotel',
      canal_origen: 'whatsapp_agente',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  clienteId = cliente.id

  const ahora = new Date()
  const { data: pedido, error: errorPedido } = await supabase
    .from('pedidos')
    .insert({
      cliente_id: clienteId,
      canal: 'whatsapp_agente',
      tipo_entrega: 'a_la_carta',
      estado: 'esperando_pago_para_recoleccion',
      metodo_transporte_recoleccion: 'app',
      pago_recoleccion: 'pendiente',
      monto_recoleccion: 3.5,
      monto_estimado_lavado: 11.25,
      numero_fundas: 1,
      vehiculo_sugerido: 'moto',
      direccion_recoleccion: `Av. de prueba ${CORRIDA}`,
      ventana_recoleccion_inicio: ahora.toISOString(),
      ventana_recoleccion_fin: new Date(ahora.getTime() + 3_600_000).toISOString(),
    })
    .select('id')
    .single()
  if (errorPedido) throw new Error(errorPedido.message)
  pedidoId = pedido.id

  await supabase.from('pedido_items').insert({
    pedido_id: pedidoId,
    origen: 'declarado',
    descripcion: 'Camiseta (agua)',
    cantidad: 5,
    precio_unitario: 2.25,
    subtotal: 11.25,
  })
})

test.afterAll(async () => {
  const supabase = admin()
  await supabase.from('pedidos').delete().eq('cliente_id', clienteId)
  await supabase.from('clientes').delete().eq('id', clienteId)
})

test('la lista de pedidos carga sin errores de consola', async ({ page }) => {
  const errores: string[] = []
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text())
  })
  page.on('pageerror', (error) => errores.push(error.message))

  await page.goto('/pedidos')
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible()
  // El nombre también sale en el selector de cliente del alta: se busca el
  // enlace de la fila, no cualquier texto que coincida.
  await expect(page.getByRole('link', { name: `Hotel E2E ${CORRIDA}` }).first()).toBeVisible()

  expect(errores, `errores en consola: ${errores.join(' | ')}`).toEqual([])
})

test('la cola de hoy muestra el pedido con su hora', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Cola de hoy' })).toBeVisible()
  // Aparece en la cola y en los leads del día: basta con que esté en pantalla.
  await expect(
    page.getByRole('link', { name: new RegExp(`Hotel E2E ${CORRIDA}`) }).first(),
  ).toBeVisible()
})

test('el catálogo lista los ítems de la planta', async ({ page }) => {
  await page.goto('/servicios')
  // Cuántos hay lo decide el dueño en esta misma pantalla.
  await expect(page.getByText(/\d+ ítems del catálogo/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Servicios' })).toBeVisible()
})

test('confirmar el pago actualiza la pantalla sin recargar', async ({ page }) => {
  await page.goto(`/pedidos/${pedidoId}`)

  await expect(page.getByText('Espera pago (recolección)')).toBeVisible()

  // Si la página recargara, este marcador desaparecería.
  await page.evaluate(() => {
    ;(window as unknown as { __sinRecargar: boolean }).__sinRecargar = true
  })

  await page.getByRole('button', { name: 'Confirmar pago' }).first().click()

  await expect(page.getByText('El despacho de ese tramo queda liberado.')).toBeVisible()

  const siguePresente = await page.evaluate(
    () => (window as unknown as { __sinRecargar?: boolean }).__sinRecargar === true,
  )
  expect(siguePresente, 'la página se recargó').toBe(true)
})

test('camino de humo: verificar conteo con discrepancia congela el pedido', async ({ page }) => {
  await page.goto(`/pedidos/${pedidoId}`)

  const campoConteo = page.getByLabel('Cantidad contada de Camiseta (agua)')
  await campoConteo.fill('7')
  await page.getByRole('button', { name: 'Verificar conteo' }).click()

  await expect(page.getByText(/El conteo no cuadra/)).toBeVisible()
  await expect(page.getByText('Pedido congelado por discrepancia.')).toBeVisible()
})
