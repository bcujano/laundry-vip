import { describe, expect, it } from 'vitest'
import { verificarSector } from '@/server/pedidos/cobertura'

describe('cobertura verificable (B4)', () => {
  const sectores = ['La Kennedy', 'Jipijapa', 'Concepción']

  it('con la lista vacía la cobertura no se verifica', () => {
    expect(verificarSector('Cumbayá', [])).toBe('sin_verificar')
    expect(verificarSector(undefined, [])).toBe('sin_verificar')
  })

  it('un sector de la lista está dentro, sin importar tildes ni mayúsculas', () => {
    expect(verificarSector('kennedy', sectores)).toBe('dentro')
    expect(verificarSector('Sector LA KENNEDY, calle de los Pinos', sectores)).toBe('dentro')
    expect(verificarSector('concepcion', sectores)).toBe('dentro')
  })

  it('un sector que no está en la lista queda fuera', () => {
    expect(verificarSector('Cumbayá', sectores)).toBe('fuera')
    expect(verificarSector('Sur de Quito', sectores)).toBe('fuera')
  })

  it('sin sector no se puede decidir', () => {
    expect(verificarSector(undefined, sectores)).toBe('falta_sector')
    expect(verificarSector('  ', sectores)).toBe('falta_sector')
  })

  it('las líneas vacías de la lista no hacen que todo entre', () => {
    expect(verificarSector('Cumbayá', ['', '  '])).toBe('sin_verificar')
    expect(verificarSector('Cumbayá', ['', 'Jipijapa'])).toBe('fuera')
  })
})
