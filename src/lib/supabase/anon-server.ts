import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Cliente anónimo para uso en el servidor: respeta RLS.
 * Se usa donde la operación debe verse limitada por las políticas de la tabla,
 * no por el rol de servicio.
 */
export function supabaseAnonServer(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
