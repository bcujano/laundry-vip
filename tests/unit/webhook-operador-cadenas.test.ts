import { describe, expect, it } from 'vitest'
import { parametrosPorAccion } from '@/server/webhook/schemas'

const OP = '+593991234567'
const ID = '6f9619ff-8b86-4011-b42d-00c04fc964ff'

describe('herramientas del operador con cadenas sencillas', () => {
  it('registrar_cliente_presencial convierte «prendas» y descarta los vacíos', () => {
    const r = parametrosPorAccion.registrar_cliente_presencial.parse({
      telefono_operador: OP,
      telefono_cliente: '+593991111111',
      nombre_contacto: 'Juan Pérez',
      nombre_negocio: '',
      prendas: '6 camisa | agua\n2 pantalón',
    })
    expect(r.items).toEqual([
      { descripcion: 'camisa', cantidad: 6, metodo: 'agua' },
      { descripcion: 'pantalón', cantidad: 2 },
    ])
    expect(r.nombre_negocio).toBeUndefined()
  })

  it('actualizar_registro acepta pedido_id vacío (usa la última orden) y prendas opcionales', () => {
    const r = parametrosPorAccion.actualizar_registro.parse({
      telefono_operador: OP,
      pedido_id: '',
      prendas: '4 camisa',
      nombre_contacto: '',
    })
    expect(r.pedido_id).toBeUndefined()
    expect(r.items).toEqual([{ descripcion: 'camisa', cantidad: 4 }])
  })

  it('avanzar_estado con pedido_id vacío y registrar_conteo desde una cadena', () => {
    const a = parametrosPorAccion.avanzar_estado.parse({
      telefono_operador: OP,
      pedido_id: '',
      estado: 'en_proceso',
    })
    expect(a.pedido_id).toBeUndefined()
    const c = parametrosPorAccion.registrar_conteo.parse({
      telefono_operador: OP,
      pedido_id: ID,
      conteos: '5 camisa\n2 pantalón',
    })
    expect(c.conteos).toEqual([
      { descripcion: 'camisa', cantidad: 5 },
      { descripcion: 'pantalón', cantidad: 2 },
    ])
  })

  it('las formas anteriores (arreglos) siguen funcionando', () => {
    const c = parametrosPorAccion.registrar_conteo.parse({
      telefono_operador: OP,
      conteos: [{ descripcion: 'camisa', cantidad: 5 }],
    })
    expect(c.conteos).toHaveLength(1)
  })
})
