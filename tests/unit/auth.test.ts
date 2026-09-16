import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUser = vi.fn()
const maybeSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: async () => ({ auth: { getUser } }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}))

const { puede, verifyAuth } = await import('@/lib/auth')

const USUARIO = { data: { user: { id: 'u-1', email: 'jefe@ejemplo.com' } }, error: null }
const STAFF_ACTIVO = {
  data: { id: 's-1', auth_user_id: 'u-1', rol: 'superadmin', estado: 'activo' },
  error: null,
}

beforeEach(() => {
  getUser.mockReset()
  maybeSingle.mockReset()
})

describe('verifyAuth', () => {
  it('devuelve la sesión de un staff activo', async () => {
    getUser.mockResolvedValue(USUARIO)
    maybeSingle.mockResolvedValue(STAFF_ACTIVO)

    const sesion = await verifyAuth()
    expect(sesion?.staff.rol).toBe('superadmin')
    expect(sesion?.email).toBe('jefe@ejemplo.com')
  })

  it('devuelve null si el token es inválido, sin lanzar', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } })
    await expect(verifyAuth()).resolves.toBeNull()
  })

  it('devuelve null si el usuario no tiene ficha en staff', async () => {
    getUser.mockResolvedValue(USUARIO)
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(verifyAuth()).resolves.toBeNull()
  })

  it('trata a un staff inactivo como no autenticado', async () => {
    getUser.mockResolvedValue(USUARIO)
    maybeSingle.mockResolvedValue({
      data: { ...STAFF_ACTIVO.data, estado: 'inactivo' },
      error: null,
    })
    await expect(verifyAuth()).resolves.toBeNull()
  })

  it('no lanza aunque el cliente de Supabase explote', async () => {
    getUser.mockRejectedValue(new Error('red caída'))
    await expect(verifyAuth()).resolves.toBeNull()
  })
})

describe('permisos por rol', () => {
  it('superadmin puede todo', () => {
    for (const area of [
      'pedidos',
      'clientes',
      'reportes',
      'servicios',
      'borrar',
      'configuracion',
      'staff',
    ] as const) {
      expect(puede('superadmin', area)).toBe(true)
    }
  })

  it('admin gestiona y borra, pero no toca configuración ni cuentas', () => {
    expect(puede('admin', 'pedidos')).toBe(true)
    expect(puede('admin', 'clientes')).toBe(true)
    expect(puede('admin', 'reportes')).toBe(true)
    expect(puede('admin', 'servicios')).toBe(true)
    expect(puede('admin', 'borrar')).toBe(true)
    expect(puede('admin', 'configuracion')).toBe(false)
    expect(puede('admin', 'staff')).toBe(false)
  })

  it('el operador trabaja pedidos y clientes, pero no borra', () => {
    expect(puede('operador', 'pedidos')).toBe(true)
    expect(puede('operador', 'clientes')).toBe(true)
    expect(puede('operador', 'borrar')).toBe(false)
    expect(puede('operador', 'reportes')).toBe(false)
    expect(puede('operador', 'servicios')).toBe(false)
    expect(puede('operador', 'configuracion')).toBe(false)
  })
})
