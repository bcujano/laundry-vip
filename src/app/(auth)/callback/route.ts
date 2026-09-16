import { type NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Cambia el código del enlace mágico por una sesión con cookies. */
export async function GET(peticion: NextRequest) {
  const codigo = peticion.nextUrl.searchParams.get('code')
  if (!codigo) {
    return NextResponse.redirect(new URL('/login?error=sin_codigo', peticion.url))
  }

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(codigo)
  if (error) {
    return NextResponse.redirect(new URL('/login?error=enlace_invalido', peticion.url))
  }

  return NextResponse.redirect(new URL('/', peticion.url))
}
