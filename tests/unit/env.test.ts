import { describe, expect, it } from 'vitest'
import { FASE_REQUERIDA, validarEntorno } from '@/lib/env'

const FASE_1_COMPLETA = {
  SUPABASE_URL: 'https://proyecto.supabase.co',
  SUPABASE_ANON_KEY: 'llave-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'llave-servicio',
}

describe('validarEntorno', () => {
  it('acepta un entorno de fase 1 completo', () => {
    const env = validarEntorno(FASE_1_COMPLETA, 1)
    expect(env.SUPABASE_URL).toBe('https://proyecto.supabase.co')
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('llave-servicio')
  })

  it('falla nombrando la variable que falta', () => {
    const { SUPABASE_URL: _omitida, ...sinUrl } = FASE_1_COMPLETA
    expect(() => validarEntorno(sinUrl, 1)).toThrowError(/SUPABASE_URL/)
  })

  it('nunca cae a un valor por defecto cuando falta una variable', () => {
    const { SUPABASE_ANON_KEY: _omitida, ...sinAnon } = FASE_1_COMPLETA
    let capturado: unknown
    try {
      validarEntorno(sinAnon, 1)
    } catch (error) {
      capturado = error
    }
    expect(capturado).toBeInstanceOf(Error)
  })

  it('trata una variable en blanco como ausente', () => {
    expect(() => validarEntorno({ ...FASE_1_COMPLETA, SUPABASE_URL: '   ' }, 1)).toThrowError(
      /SUPABASE_URL/,
    )
  })

  it('rechaza una URL que no es absoluta', () => {
    expect(() =>
      validarEntorno({ ...FASE_1_COMPLETA, SUPABASE_URL: 'proyecto.supabase.co' }, 1),
    ).toThrowError(/SUPABASE_URL/)
  })

  it('no exige en fase 1 variables de fases posteriores', () => {
    expect(() => validarEntorno(FASE_1_COMPLETA, 1)).not.toThrow()
  })

  it('sí exige en fase 2 la conexión directa a Postgres', () => {
    expect(() => validarEntorno(FASE_1_COMPLETA, 2)).toThrowError(/SUPABASE_DB_URL/)
  })

  it('rechaza una cadena de conexión que no es de Postgres', () => {
    expect(() =>
      validarEntorno(
        { ...FASE_1_COMPLETA, SUPABASE_DB_URL: 'mysql://x', TEST_DATABASE_URL: 'mysql://x' },
        2,
      ),
    ).toThrowError(/SUPABASE_DB_URL/)
  })

  it('convierte el tope de costo de OpenAI a número en la fase 11', () => {
    const entorno: Record<string, string> = { ...FASE_1_COMPLETA }
    for (const nombre of Object.keys(FASE_REQUERIDA)) {
      if (entorno[nombre]) continue
      entorno[nombre] = nombre.includes('DB_URL')
        ? 'postgresql://u:p@host:5432/postgres'
        : nombre.includes('DATABASE_URL')
          ? 'postgresql://u:p@host:5432/postgres'
          : nombre.includes('BASE_URL')
            ? 'https://ejemplo.com'
            : nombre === 'OPENAI_COST_ALERT_DAILY_USD'
              ? '5.00'
              : 'valor'
    }
    const env = validarEntorno(entorno, 13)
    expect(env.OPENAI_COST_ALERT_DAILY_USD).toBe(5)
  })
})
