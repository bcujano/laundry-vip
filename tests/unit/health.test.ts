import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('GET /api/health', () => {
  it('responde 200 con ok: true', async () => {
    const respuesta = GET()
    expect(respuesta.status).toBe(200)

    const cuerpo = (await respuesta.json()) as { ok: boolean; servicio: string }
    expect(cuerpo.ok).toBe(true)
    expect(cuerpo.servicio).toBe('laundry-vip')
  })
})
