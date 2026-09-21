import { describe, expect, it } from 'vitest'
import { csvCatalogo } from '@/server/exportar/catalogo'
import { csvClientes, csvPedidos } from '@/server/exportar/repo'
import { contar } from '@/server/servicios/repo'

/** Las descargas leen la base real: se prueba la forma, no un conteo fijo. */
describe('descargas de la base', () => {
  it('clientes: una fila por cliente con sus columnas', async () => {
    const csv = await csvClientes()
    const lineas = csv.slice(1).trim().split('\r\n')
    expect(lineas[0]).toContain('Negocio;Contacto;Teléfono;Tipo')
    expect(lineas[0]).toContain('Facturado verificado USD')
    for (const linea of lineas.slice(1)) expect(linea).toMatch(/;\+\d{8,15};/)
  })

  it('lista de precios: una fila por ítem del catálogo de hoy', async () => {
    const csv = await csvCatalogo()
    const lineas = csv.slice(1).trim().split('\r\n')

    expect(lineas[0]).toContain('Categoría;Prenda o artículo;Método;Se cobra por;Precio USD')
    expect(lineas[0]).toContain('Promoción')
    // Lo que se descarga es lo que hay en el CRM, ni más ni menos.
    expect(lineas.length - 1).toBe(await contar())
  })

  it('pedidos: incluye cliente, estado, prendas y montos', async () => {
    const csv = await csvPedidos()
    const cabecera = csv.slice(1).split('\r\n')[0]
    for (const columna of ['Cliente', 'Estado', 'Prendas', 'Estimado lavado USD', 'Discrepancia']) {
      expect(cabecera).toContain(columna)
    }
  })
})
