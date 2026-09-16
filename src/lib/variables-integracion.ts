/**
 * Variables que necesita la instancia de n8n, no el CRM.
 *
 * Vive en su propio archivo a propósito: env.ts valida todo el entorno al
 * importarse, y el script de comprobación necesita esta lista ANTES de que
 * exista ninguna configuración válida.
 */
export const VARIABLES_INTEGRACION = [
  'CRM_BASE_URL',
  'N8N_WEBHOOK_SECRET',
  'OPENAI_API_KEY',
  'CHATWOOT_BASE_URL',
  'CHATWOOT_API_TOKEN',
  'CHATWOOT_ACCOUNT_ID',
  'WHATSAPP_CLOUD_API_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_VERIFY_TOKEN',
] as const

export type VariableIntegracion = (typeof VARIABLES_INTEGRACION)[number]
