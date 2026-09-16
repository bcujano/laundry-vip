import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

const { proxy } = await import('@/proxy')

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

  it('deja pasar el callback del enlace mágico', async () => {
    getUser.mockResolvedValue(ANONIMO)
    const respuesta = await proxy(peticion('/callback?code=abc'))
    expect(respuesta.headers.get('location')).toBeNull()
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
