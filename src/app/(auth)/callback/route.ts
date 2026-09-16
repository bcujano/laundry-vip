import type { EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Cierra el enlace mágico. Supabase puede devolver la credencial de tres
 * formas distintas y las tres tienen que funcionar:
 *   ?code=...                  flujo PKCE
 *   ?token_hash=...&type=...   plantilla de correo con {{ .TokenHash }}
 *   #access_token=...          plantilla por defecto: va en el fragmento, que
 *                              el servidor NO recibe, así que se delega a
 *                              /sesion, que sí lo ve desde el navegador.
 */
export async function GET(peticion: NextRequest) {
  const parametros = peticion.nextUrl.searchParams
  const codigo = parametros.get('code')
  const tokenHash = parametros.get('token_hash')
  const tipo = parametros.get('type') as EmailOtpType | null

  if (!codigo && !tokenHash) {
    // El navegador vuelve a pegar el fragmento al seguir esta redirección.
    return NextResponse.redirect(new URL('/sesion', peticion.url))
  }

  const supabase = await supabaseServer()

  const { error } = codigo
    ? await supabase.auth.exchangeCodeForSession(codigo)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash as string,
        type: tipo ?? 'magiclink',
      })

  if (error) {
    return NextResponse.redirect(new URL('/login?error=enlace_invalido', peticion.url))
  }

  return NextResponse.redirect(new URL('/', peticion.url))
}
