import { VARIABLES_INTEGRACION } from '../src/lib/variables-integracion.ts'
import { cargarEntorno } from './db-conexion.ts'

/**
 * Comprueba las credenciales que necesita la instancia de n8n, no el CRM.
 * Sale 0 si están las nueve y son plausibles; sale 1 nombrando en stderr las
 * que faltan o están mal, para que el fallo se pueda leer en un log de CI.
 *
 * No hace ninguna llamada de red: no valida que el token sirva, valida que
 * exista y tenga la forma correcta. Ningún gate depende de una cuenta viva.
 */

type Regla = { patron: RegExp; explicacion: string }

const REGLAS: Record<string, Regla> = {
  CRM_BASE_URL: {
    patron: /^https?:\/\/[^\s/]+(\/.*)?$/,
    explicacion: 'debe ser una URL absoluta, sin barra final',
  },
  N8N_WEBHOOK_SECRET: {
    patron: /^.{24,}$/,
    explicacion: 'debe tener al menos 24 caracteres',
  },
  OPENAI_API_KEY: {
    patron: /^sk-/,
    explicacion: 'las claves de OpenAI empiezan por "sk-"',
  },
  CHATWOOT_BASE_URL: {
    patron: /^https?:\/\/[^\s/]+$/,
    explicacion: 'debe ser una URL absoluta sin ruta ni barra final',
  },
  CHATWOOT_API_TOKEN: { patron: /^.{16,}$/, explicacion: 'parece demasiado corto' },
  CHATWOOT_ACCOUNT_ID: { patron: /^\d+$/, explicacion: 'debe ser un número (normalmente 1)' },
  WHATSAPP_CLOUD_API_TOKEN: {
    patron: /^.{40,}$/,
    explicacion: 'un token permanente de Meta es mucho más largo',
  },
  WHATSAPP_PHONE_NUMBER_ID: {
    patron: /^\d{10,}$/,
    explicacion: 'debe ser el id numérico, no el número de teléfono',
  },
  WHATSAPP_VERIFY_TOKEN: {
    patron: /^.{12,}$/,
    explicacion: 'que tenga al menos 12 caracteres: lo verá Meta en claro',
  },
}

export type Problema = { variable: string; motivo: string }

export function revisar(fuente: Record<string, string | undefined>): Problema[] {
  const problemas: Problema[] = []

  for (const variable of VARIABLES_INTEGRACION) {
    const valor = fuente[variable]?.trim()

    if (!valor) {
      problemas.push({ variable, motivo: 'falta, no está definida' })
      continue
    }

    const regla = REGLAS[variable]
    if (regla && !regla.patron.test(valor)) {
      problemas.push({ variable, motivo: regla.explicacion })
    }
  }

  return problemas
}

function main(): void {
  cargarEntorno()
  const problemas = revisar(process.env)

  if (problemas.length === 0) {
    console.log(`Las ${VARIABLES_INTEGRACION.length} variables de integración están completas.`)
    process.exit(0)
  }

  console.error('Faltan o están mal estas variables de integración:')
  for (const problema of problemas) {
    console.error(`  - ${problema.variable}: ${problema.motivo}`)
  }
  console.error('\nRevisa docs/CHATWOOT_Y_WHATSAPP.md para saber de dónde sale cada una.')
  process.exit(1)
}

if (import.meta.filename === process.argv[1]) {
  main()
}
