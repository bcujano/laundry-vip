import { describe, expect, it } from 'vitest'
import { parsearPrendas } from '@/server/pricing/prendas-texto'
import { parametrosPorAccion } from '@/server/webhook/schemas'

/** Las prendas llegan como texto desde las herramientas del agente (un modelo pequeño no arma JSON anidado). */
describe('prendas escritas como texto', () => {
  it('una prenda por línea: cantidad y nombre', () => {
    expect(parsearPrendas('3 terno 2 piezas\n10 lavado secado y doblado')).toEqual([
      { descripcion: 'terno 2 piezas', cantidad: 3 },
      { descripcion: 'lavado secado y doblado', cantidad: 10 },
    ])
  })

  it('acepta ; como separador, «x», decimales con coma y espacios de sobra', () => {
    expect(parsearPrendas('  2 x camiseta ;  2,5 libras de ropa  ')).toEqual([
      { descripcion: 'camiseta', cantidad: 2 },
      { descripcion: 'libras de ropa', cantidad: 2.5 },
    ])
  })

  it('el método solo entra si es uno de los cuatro y va tras «|»', () => {
    expect(parsearPrendas('2 camiseta | agua\n1 pantalón | seco\n1 saco | magia')).toEqual([
      { descripcion: 'camiseta', cantidad: 2, metodo: 'agua' },
      { descripcion: 'pantalón', cantidad: 1, metodo: 'seco' },
      { descripcion: 'saco', cantidad: 1 },
    ])
  })

  it('sin número la cantidad es 1; las líneas vacías no cuentan', () => {
    expect(parsearPrendas('edredón de plumas\n\n  \n')).toEqual([
      { descripcion: 'edredón de plumas', cantidad: 1 },
    ])
    expect(parsearPrendas('')).toEqual([])
    expect(parsearPrendas('3')).toEqual([])
  })
})

describe('el contrato del webhook acepta texto además de items', () => {
  it('cotizar_prendas: «prendas» se convierte en items y items sigue valiendo', () => {
    const esquema = parametrosPorAccion.cotizar_prendas
    const deTexto = esquema.safeParse({ prendas: '3 terno 2 piezas' })
    expect(deTexto.success && deTexto.data.items).toEqual([
      { descripcion: 'terno 2 piezas', cantidad: 3 },
    ])
    const clasico = esquema.safeParse({
      items: [{ descripcion: 'camisa', cantidad: 2, metodo: 'agua' }],
    })
    expect(clasico.success).toBe(true)
  })

  it('crear_pedido con cadenas: vacías = ausentes, canal por defecto y transporte propio si el cliente trae y retira', () => {
    const base = {
      cliente_id: '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
      prendas: '2 edredón 3 plazas',
      direccion_recoleccion: '',
      sector: '',
      ventana_recoleccion_inicio: '',
      ventana_recoleccion_fin: '',
    }
    const traeYRetira = parametrosPorAccion.crear_pedido.safeParse({
      ...base,
      tipo_entrega: 'a_la_carta',
    })
    expect(traeYRetira.success).toBe(true)
    if (traeYRetira.success) {
      expect(traeYRetira.data.canal).toBe('whatsapp_agente')
      expect(traeYRetira.data.items).toHaveLength(1)
      expect(traeYRetira.data.metodo_transporte_recoleccion).toBe('propio_cliente')
      expect(traeYRetira.data.metodo_transporte_entrega).toBe('propio_cliente')
      expect(traeYRetira.data.direccion_recoleccion).toBeUndefined()
    }
    const recoge = parametrosPorAccion.crear_pedido.safeParse({
      ...base,
      tipo_entrega: 'combo',
      direccion_recoleccion: 'Av. Los Pinos y Pedro Barrios',
      ventana_recoleccion_inicio: '2026-10-10T14:00:00.000Z',
    })
    expect(recoge.success && recoge.data.metodo_transporte_recoleccion).toBeFalsy()
  })

  it('un cliente_id que no es uuid sigue rechazándose', () => {
    expect(
      parametrosPorAccion.crear_pedido.safeParse({ cliente_id: 'abc', prendas: '1 saco' }).success,
    ).toBe(false)
  })
})
