import { z } from 'zod'

/**
 * Fase de construcción en curso (sección 12 del plan).
 * Una variable solo es obligatoria a partir de la fase que la usa, para que los
 * gates de las fases anteriores no se rompan por credenciales que aún no existen.
 */
export const FASE_ACTUAL = 8

/** Desde qué fase pasa a ser obligatoria cada variable (sección 4 del plan). */
export const FASE_REQUERIDA = {
  SUPABASE_URL: 1,
  SUPABASE_ANON_KEY: 1,
  SUPABASE_SERVICE_ROLE_KEY: 1,
  SUPABASE_DB_URL: 2,
  TEST_DATABASE_URL: 2,
  NEXT_PUBLIC_SUPABASE_URL: 3,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 3,
  N8N_WEBHOOK_SECRET: 8,
  OPENAI_COST_ALERT_DAILY_USD: 11,
  CRM_BASE_URL: 12,
  OPENAI_API_KEY: 12,
  CHATWOOT_BASE_URL: 13,
  CHATWOOT_API_TOKEN: 13,
  CHATWOOT_ACCOUNT_ID: 13,
  WHATSAPP_CLOUD_API_TOKEN: 13,
  WHATSAPP_PHONE_NUMBER_ID: 13,
  WHATSAPP_VERIFY_TOKEN: 13,
} as const

export type NombreVariable = keyof typeof FASE_REQUERIDA

/** Variables que deben ser una URL absoluta válida, no solo texto no vacío. */
const SON_URL = new Set<NombreVariable>([
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'CRM_BASE_URL',
  'CHATWOOT_BASE_URL',
])

/** Variables que deben ser una cadena de conexión de Postgres. */
const SON_CONEXION_PG = new Set<NombreVariable>(['SUPABASE_DB_URL', 'TEST_DATABASE_URL'])

/** Variables numéricas: se validan como número positivo, no como texto. */
const SON_NUMERO = new Set<NombreVariable>(['OPENAI_COST_ALERT_DAILY_USD'])

function esquemaDeVariable(nombre: NombreVariable, obligatoria: boolean) {
  let base: z.ZodType<unknown>

  if (SON_NUMERO.has(nombre)) {
    base = z.coerce.number().positive(`${nombre} debe ser un número positivo`)
  } else if (SON_URL.has(nombre)) {
    base = z.url(`${nombre} debe ser una URL absoluta (https://...)`)
  } else if (SON_CONEXION_PG.has(nombre)) {
    base = z
      .string()
      .regex(/^postgres(ql)?:\/\/.+/, `${nombre} debe ser una cadena postgresql://...`)
  } else {
    base = z.string().min(1, `${nombre} no puede estar vacía`)
  }

  return obligatoria ? base : base.optional()
}

/** Construye el esquema completo para una fase dada. */
export function esquemaParaFase(fase: number) {
  const campos: Record<string, z.ZodType<unknown>> = {}
  for (const nombre of Object.keys(FASE_REQUERIDA) as NombreVariable[]) {
    campos[nombre] = esquemaDeVariable(nombre, FASE_REQUERIDA[nombre] <= fase)
  }
  return z.object(campos)
}

/**
 * Valida el entorno y devuelve las variables tipadas.
 * Si falta o es inválida alguna variable obligatoria, lanza nombrándolas todas.
 * Nunca devuelve un valor por defecto.
 */
export function validarEntorno(fuente: Record<string, string | undefined>, fase: number) {
  // Vacío y ausente son lo mismo: una variable en blanco no es una configuración.
  const limpio: Record<string, string | undefined> = {}
  for (const nombre of Object.keys(FASE_REQUERIDA)) {
    const valor = fuente[nombre]
    limpio[nombre] = valor === undefined || valor.trim() === '' ? undefined : valor
  }

  const resultado = esquemaParaFase(fase).safeParse(limpio)

  if (!resultado.success) {
    const detalles = resultado.error.issues.map((issue) => {
      const nombre = String(issue.path[0] ?? '(desconocida)')
      // Distinguir "no está definida" de "está pero es inválida" evita mandar al
      // dueño a revisar el formato de una variable que simplemente no existe.
      const motivo = limpio[nombre] === undefined ? 'falta, no está definida' : issue.message
      return `  - ${nombre}: ${motivo}`
    })
    throw new Error(
      `Configuración de entorno inválida (fase ${fase}). Revisa tu .env.local:\n${detalles.join('\n')}`,
    )
  }

  return resultado.data as EntornoValidado
}

/**
 * Todas las variables se tipan como presentes. Es cierto solo para las de
 * FASE_ACTUAL o anteriores: leer una de una fase posterior compila pero da
 * undefined en ejecución. Cada fase usa las suyas.
 */
export type EntornoValidado = {
  [K in NombreVariable]: K extends 'OPENAI_COST_ALERT_DAILY_USD' ? number : string
}

/**
 * Las NEXT_PUBLIC_* se nombran literalmente para que Next pueda sustituirlas
 * en tiempo de compilación; un acceso dinámico a process.env no se reemplaza.
 */
const FUENTE: Record<string, string | undefined> = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}

export const env = validarEntorno(FUENTE, FASE_ACTUAL)
