import { describe, expect, it } from 'vitest'
import { csvClientes, csvPedidos } from '@/server/exportar/repo'

/** Las descargas leen la base real: se prueba la forma, no un conteo fijo. */
describe('descargas de la base', () => {
  it('clientes: una fila por cliente con sus columnas', async () => {
    const csv = await csvClientes()
    const lineas = csv.slice(1).trim().split('\r\n')
    expect(lineas[0]).toContain('Negocio;Contacto;Teléfono;Tipo')
    expect(lineas[0]).toContain('Facturado verificado USD')
    for (const linea of lineas.slice(1)) expect(linea).toMatch(/;\+\d{8,15};/)
  })

  it('pedidos: incluye cliente, estado, prendas y montos', async () => {
    const csv = await csvPedidos()
    const cabecera = csv.slice(1).split('\r\n')[0]
    for (const columna of ['Cliente', 'Estado', 'Prendas', 'Estimado lavado USD', 'Discrepancia']) {
      expect(cabecera).toContain(columna)
    }
  })
})
