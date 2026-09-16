import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

/** Rutas que un anónimo sí puede ver. */
const PUBLICAS = ['/login', '/callback']

/**
 * Protección de rutas. En Next 16 vive en src/proxy.ts, no en middleware.ts.
 * Solo comprueba que haya una sesión: si además esa persona es staff activo lo
 * decide verifyAuth() en el servidor, que es donde está la autorización real.
 */
export async function proxy(peticion: NextRequest) {
  const respuesta = NextResponse.next({ request: peticion })
  const ruta = peticion.nextUrl.pathname

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll: () => peticion.cookies.getAll(),
        setAll: (cookiesNuevas) => {
          for (const { name, value, options } of cookiesNuevas) {
            respuesta.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const esPublica = PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))

  if (!user && !esPublica) {
    const destino = new URL('/login', peticion.url)
    return NextResponse.redirect(destino)
  }

  if (user && ruta === '/login') {
    return NextResponse.redirect(new URL('/', peticion.url))
  }

  return respuesta
}

export const config = {
  // Se excluyen los assets y /api: el webhook del agente se autentica con su
  // propio secreto, no con la sesión del navegador.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
