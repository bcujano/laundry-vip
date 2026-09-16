import { describe, expect, it } from 'vitest'
import { esE164, normalizarTelefono } from '@/lib/telefono'

describe('normalizarTelefono', () => {
  it('convierte el formato nacional ecuatoriano', () => {
    expect(normalizarTelefono('0963987124')).toBe('+593963987124')
  })

  it('acepta el número sin el cero inicial', () => {
    expect(normalizarTelefono('963987124')).toBe('+593963987124')
  })

  it('limpia espacios, guiones y paréntesis', () => {
    expect(normalizarTelefono('+593 (96) 398-7124')).toBe('+593963987124')
    expect(normalizarTelefono('096 398 7124')).toBe('+593963987124')
  })

  it('respeta un número internacional que ya viene completo', () => {
    expect(normalizarTelefono('+14155552671')).toBe('+14155552671')
  })

  it('devuelve null ante basura', () => {
    expect(normalizarTelefono('')).toBeNull()
    expect(normalizarTelefono('no soy un teléfono')).toBeNull()
    expect(normalizarTelefono('123')).toBeNull()
  })

  it('todo lo que devuelve pasa la validación de la base', () => {
    for (const entrada of ['0963987124', '963987124', '+593 96 398 7124']) {
      const normalizado = normalizarTelefono(entrada)
      expect(normalizado).not.toBeNull()
      expect(esE164(normalizado as string)).toBe(true)
    }
  })
})
