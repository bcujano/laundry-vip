import { NextResponse } from 'next/server'
import { FASE_ACTUAL } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export function GET() {
  // Importar este módulo ya validó el entorno; construir el cliente prueba que
  // las credenciales tienen la forma correcta, sin tocar todavía la base.
  supabaseAdmin()

  return NextResponse.json({
    ok: true,
    servicio: 'laundry-vip',
    fase: FASE_ACTUAL,
    hora: new Date().toISOString(),
  })
}
