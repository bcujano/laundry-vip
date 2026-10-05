import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

const { proxy, config } = await import('@/proxy')

function peticion(ruta: string) {
  return new NextRequest(new URL(ruta, 'http://localhost:3000'))
}

const ANONIMO = { data: { user: null } }
const CON_SESION = { data: { user: { id: 'u-1' } } }

beforeEach(() => {
  getUser.mockReset()
})

describe('protección de rutas', () => {
  it('manda a /login a un anónimo que entra al panel', async () => {
    getUser.mockResolvedValue(ANONIMO)
    const respuesta = await proxy(peticion('/'))
    expect(respuesta.status).toBe(307)
    expect(respuesta.headers.get('location')).toContain('/login')
  })

  it('deja pasar a un anónimo a /login', async () => {
    getUser.mockResolvedValue(ANONIMO)
    const respuesta = await proxy(peticion('/login'))
    expect(respuesta.headers.get('location')).toBeNull()
  })

  it('manda al login cualquier ruta que no sea pública', async () => {
    getUser.mockResolvedValue(ANONIMO)
    for (const ruta of ['/clientes', '/pipeline', '/usuarios', '/reportes']) {
      const respuesta = await proxy(peticion(ruta))
      expect(respuesta.headers.get('location'), ruta).toContain('/login')
    }
  })

  it('saca de /login a quien ya tiene sesión', async () => {
    getUser.mockResolvedValue(CON_SESION)
    const respuesta = await proxy(peticion('/login'))
    expect(respuesta.status).toBe(307)
    expect(respuesta.headers.get('location')).toMatch(/\/$/)
  })

  it('deja entrar al panel a quien tiene sesión', async () => {
    getUser.mockResolvedValue(CON_SESION)
    const respuesta = await proxy(peticion('/pedidos'))
    expect(respuesta.headers.get('location')).toBeNull()
  })
})

describe('sesión rota', () => {
  function conCookieRota(ruta: string) {
    const peticion = new NextRequest(new URL(ruta, 'http://localhost:3000'))
    peticion.cookies.set('sb-proyecto-auth-token', 'basura-caducada')
    return peticion
  }

  it('un token inválido NO cuenta como sesión: manda al login', async () => {
    // getUser devuelve error cuando el refresh token ya no sirve.
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'refresh_token_not_found' },
    })

    const respuesta = await proxy(conCookieRota('/'))
    expect(respuesta.headers.get('location')).toContain('/login')
  })

  it('borra las cookies rotas para que no se arme un bucle', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } })

    const respuesta = await proxy(conCookieRota('/'))
    const borradas = respuesta.cookies.getAll().filter((cookie) => cookie.value === '')
    expect(borradas.length).toBeGreaterThan(0)
  })

  it('con cookies rotas, /login se queda en /login', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } })

    const respuesta = await proxy(conCookieRota('/login'))
    expect(respuesta.headers.get('location')).toBeNull()
  })

  it('si getUser explota, se trata como anónimo y no se cuelga', async () => {
    getUser.mockRejectedValue(new Error('red caída'))

    const respuesta = await proxy(conCookieRota('/pedidos'))
    expect(respuesta.headers.get('location')).toContain('/login')
  })

  it('la imagen del catálogo es pública: n8n la descarga sin sesión', () => {
    const patron = new RegExp(`^${config.matcher[0]}$`)
    expect(patron.test('/catalogo.png')).toBe(false)
    expect(patron.test('/clientes')).toBe(true)
  })
})
