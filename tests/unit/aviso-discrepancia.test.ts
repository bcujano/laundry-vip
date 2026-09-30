import { describe, expect, it } from 'vitest'
import { textoAviso } from '@/server/avisos/texto'

describe('aviso de discrepancia al cliente', () => {
  it('por conteo: dice qué no cuadró, de cuánto a cuánto pasa el valor y no pide nada', () => {
    const texto = textoAviso({
      tipo: 'discrepancia_conteo',
      nombre: 'Ana',
      montoAnterior: 7,
      montoNuevo: 9.8,
      diferencias: [{ descripcion: 'Camiseta', declarada: 5, real: 7 }],
    })
    expect(texto).toContain('Hola, Ana.')
    expect(texto).toContain('Camiseta: usted indicó 5 y contamos 7')
    expect(texto).toContain('pasa de $7,00 a $9,80')
    expect(texto).toContain('Por ahora no necesita hacer nada')
  })

  it('por corrección de monto: explica el motivo', () => {
    const texto = textoAviso({
      tipo: 'correccion_monto',
      nombre: null,
      montoAnterior: 12,
      montoNuevo: 15.5,
      motivo: 'Incluía una cobija más',
    })
    expect(texto.startsWith('Hola.')).toBe(true)
    expect(texto).toContain('cambia de $12,00 a $15,50')
    expect(texto).toContain('Motivo: Incluía una cobija más.')
  })

  it('respeta la regla de dinero: no da cuentas, no pide transferir ni negocia', () => {
    const texto = textoAviso({
      tipo: 'discrepancia_conteo',
      nombre: null,
      montoAnterior: 5,
      montoNuevo: 6,
      diferencias: [{ descripcion: 'Sábana', declarada: 1, real: 2 }],
    }).toLowerCase()
    for (const prohibida of ['transfer', 'cuenta', 'deposit', 'pague', 'pago', 'descuento']) {
      expect(texto).not.toContain(prohibida)
    }
  })
})
