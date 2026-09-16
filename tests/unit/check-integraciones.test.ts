import { describe, expect, it } from 'vitest'
import { VARIABLES_INTEGRACION } from '@/lib/variables-integracion'
import { revisar } from '../../scripts/check-integraciones-env.ts'

const COMPLETO: Record<string, string> = {
  CRM_BASE_URL: 'https://crm.lavanderiavip.ec',
  N8N_WEBHOOK_SECRET: 'a'.repeat(43),
  OPENAI_API_KEY: `sk-${'b'.repeat(40)}`,
  CHATWOOT_BASE_URL: 'https://chat.lavanderiavip.ec',
  CHATWOOT_API_TOKEN: 'c'.repeat(32),
  CHATWOOT_ACCOUNT_ID: '1',
  WHATSAPP_CLOUD_API_TOKEN: `EAA${'d'.repeat(80)}`,
  WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
  WHATSAPP_VERIFY_TOKEN: 'verificacion-lavanderia',
}

describe('verificador de integraciones', () => {
  it('son nueve variables', () => {
    expect(VARIABLES_INTEGRACION).toHaveLength(9)
  })

  it('con las nueve válidas no reporta nada', () => {
    expect(revisar(COMPLETO)).toEqual([])
  })

  it('nombra la variable que falta', () => {
    const { CHATWOOT_API_TOKEN: _omitida, ...incompleto } = COMPLETO
    const problemas = revisar(incompleto)

    expect(problemas).toHaveLength(1)
    expect(problemas[0]?.variable).toBe('CHATWOOT_API_TOKEN')
    expect(problemas[0]?.motivo).toContain('falta')
  })

  it('trata una variable en blanco como ausente', () => {
    const problemas = revisar({ ...COMPLETO, WHATSAPP_VERIFY_TOKEN: '   ' })
    expect(problemas[0]?.variable).toBe('WHATSAPP_VERIFY_TOKEN')
  })

  it('detecta una clave de OpenAI con formato incorrecto', () => {
    const problemas = revisar({ ...COMPLETO, OPENAI_API_KEY: 'mi-clave-secreta' })
    expect(problemas[0]?.variable).toBe('OPENAI_API_KEY')
    expect(problemas[0]?.motivo).toContain('sk-')
  })

  it('detecta que pusieron el número en vez del id del teléfono', () => {
    const problemas = revisar({ ...COMPLETO, WHATSAPP_PHONE_NUMBER_ID: '+593963987124' })
    expect(problemas[0]?.variable).toBe('WHATSAPP_PHONE_NUMBER_ID')
    expect(problemas[0]?.motivo).toContain('id numérico')
  })

  it('rechaza una URL de Chatwoot con barra final', () => {
    const problemas = revisar({ ...COMPLETO, CHATWOOT_BASE_URL: 'https://chat.ejemplo.com/' })
    expect(problemas[0]?.variable).toBe('CHATWOOT_BASE_URL')
  })

  it('rechaza un secreto de webhook demasiado corto', () => {
    const problemas = revisar({ ...COMPLETO, N8N_WEBHOOK_SECRET: 'corto' })
    expect(problemas[0]?.variable).toBe('N8N_WEBHOOK_SECRET')
  })

  it('reporta todas las que faltan, no solo la primera', () => {
    const problemas = revisar({ CRM_BASE_URL: 'https://crm.ejemplo.com' })
    expect(problemas).toHaveLength(8)
  })
})
