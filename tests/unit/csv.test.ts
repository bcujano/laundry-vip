import { describe, expect, it } from 'vitest'
import { aCsv, fechaCsv } from '@/server/exportar/csv'

describe('CSV para Excel en español', () => {
  const csv = aCsv(
    [{ nombre: 'Clínica "La Paz"; norte', monto: 12.5, activo: true, nota: null }],
    [
      { titulo: 'Nombre', valor: (f) => f.nombre },
      { titulo: 'Monto USD', valor: (f) => f.monto },
      { titulo: 'Activo', valor: (f) => f.activo },
      { titulo: 'Nota', valor: (f) => f.nota },
    ],
  )

  it('empieza con BOM para que las tildes no salgan rotas', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('usa punto y coma, coma decimal y escapa comillas', () => {
    const [cabecera, fila] = csv.slice(1).split('\r\n')
    expect(cabecera).toBe('Nombre;Monto USD;Activo;Nota')
    expect(fila).toBe('"Clínica ""La Paz""; norte";12,5;Sí;')
  })

  it('las fechas salen en hora de Quito', () => {
    expect(fechaCsv('2026-09-17T13:05:00.000Z')).toBe('2026-09-17 08:05')
    expect(fechaCsv(null)).toBe('')
  })
})
