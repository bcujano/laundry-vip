import { beforeEach, describe, expect, it, vi } from 'vitest'

const exigirPermiso = vi.fn()
const actualizarPrecio = vi.fn()
const crearServicioRepo = vi.fn()

vi.mock('@/lib/auth', () => ({ exigirPermiso }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/server/servicios/repo', () => ({
  actualizarPrecio,
  alternarActivo: vi.fn(),
  crear: crearServicioRepo,
}))

const { crearServicio, guardarPrecio } = await import('@/app/(dashboard)/servicios/actions')

function formulario(campos: Record<string, string>): FormData {
  const datos = new FormData()
  for (const [clave, valor] of Object.entries(campos)) datos.set(clave, valor)
  return datos
}

const PRECIO_VALIDO = {
  id: '11111111-1111-4111-8111-111111111111',
  precio_min: '5.00',
  precio_max: '5.00',
}

beforeEach(() => {
  exigirPermiso.mockReset()
  actualizarPrecio.mockReset()
  crearServicioRepo.mockReset()
})

describe('editar precios', () => {
  it('un operador no puede: se rechaza en el servidor', async () => {
    // exigirPermiso devuelve null para quien no tiene el área 'servicios'.
    exigirPermiso.mockResolvedValue(null)

    const resultado = await guardarPrecio({}, formulario(PRECIO_VALIDO))

    expect(resultado.error).toBe('No tienes permiso para editar precios.')
    // Lo importante: ni siquiera se intentó escribir.
    expect(actualizarPrecio).not.toHaveBeenCalled()
  })

  it('un operador tampoco puede crear ítems del catálogo', async () => {
    exigirPermiso.mockResolvedValue(null)

    const resultado = await crearServicio(
      {},
      formulario({
        categoria: 'Ropa de cama',
        nombre_item: 'Cosa nueva',
        metodo: 'unico',
        unidad: 'pieza',
        precio_min: '4.00',
        precio_max: '4.00',
      }),
    )

    expect(resultado.error).toContain('No tienes permiso')
    expect(crearServicioRepo).not.toHaveBeenCalled()
  })

  it('el superadmin sí guarda', async () => {
    exigirPermiso.mockResolvedValue({ staff: { rol: 'superadmin' } })
    actualizarPrecio.mockResolvedValue({ ok: true })

    const resultado = await guardarPrecio({}, formulario(PRECIO_VALIDO))

    expect(resultado.ok).toBe(true)
    // Sin campo de promoción en el formulario, el precio del paquete no se toca.
    expect(actualizarPrecio).toHaveBeenCalledWith(PRECIO_VALIDO.id, 5, 5, undefined)
  })

  it('valida antes de escribir aunque tenga permiso', async () => {
    exigirPermiso.mockResolvedValue({ staff: { rol: 'superadmin' } })

    const resultado = await guardarPrecio({}, formulario({ ...PRECIO_VALIDO, precio_min: '-3' }))

    expect(resultado.error).toBe('El precio no puede ser negativo.')
    expect(actualizarPrecio).not.toHaveBeenCalled()
  })
})
