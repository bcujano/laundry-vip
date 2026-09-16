import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Cliente con service_role: ignora RLS por diseño de Supabase.
 * Solo puede usarse desde el servidor y solo a través de src/server/**.
 * Las pantallas de src/app/** nunca lo importan directamente.
 */
let cliente: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin() no puede usarse en el navegador: expondría el service_role.')
  }
  if (!cliente) {
    cliente = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cliente
}
