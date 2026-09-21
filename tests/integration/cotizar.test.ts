import { describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calcularVehiculo, cotizarPrendas, ErrorCotizacion } from '@/server/pricing/cotizar'

/** Se cotiza contra el catálogo real de la planta, no contra uno de mentira. */

describe('método obligatorio', () => {
  it('"3 camisetas" sin método pide el método y NO da precio', async () => {
    const { lineas, resumen } = await cotizarPrendas([{ descripcion: '3 camisetas', cantidad: 3 }])
    const linea = lineas[0]

    expect(linea?.requiere_metodo).toBe(true)
    expect(linea?.nombre_item).toBe('Camiseta')
    expect(linea?.subtotal).toBeUndefined()
    expect(linea?.precio_unitario).toBeUndefined()
    expect(linea?.metodos_disponibles?.sort()).toEqual(['agua', 'seco'])
    expect(resumen.requiere_respuesta_del_cliente).toBe(true)
    expect(resumen.subtotal).toBe(0)
  })

  it('"3 camisetas" en agua cuesta 6.75', async () => {
    const { lineas, resumen } = await cotizarPrendas([
      { descripcion: '3 camisetas', cantidad: 3, metodo: 'agua' },
    ])

    expect(lineas[0]?.precio_unitario).toBe(2.25)
    expect(lineas[0]?.subtotal).toBe(6.75)
    expect(resumen.subtotal).toBe(6.75)
    expect(resumen.requiere_respuesta_del_cliente).toBe(false)
  })

  it('camisa o blusa también exige método, y en seco son 2.50', async () => {
    const sinMetodo = await cotizarPrendas([{ descripcion: '2 camisas', cantidad: 2 }])
    expect(sinMetodo.lineas[0]?.requiere_metodo).toBe(true)
    expect(sinMetodo.lineas[0]?.metodos_disponibles?.sort()).toEqual(['agua', 'planchado', 'seco'])

    const conMetodo = await cotizarPrendas([
      { descripcion: '2 camisas', cantidad: 2, metodo: 'seco' },
    ])
    expect(conMetodo.lineas[0]?.subtotal).toBe(5)
  })
})

describe('lo que no está en el catálogo', () => {
  it('va sin precio y con la nota, nunca con un precio inventado', async () => {
    const { lineas, resumen } = await cotizarPrendas([
      { descripcion: 'un kayak inflable', cantidad: 1 },
    ])

    expect(lineas[0]?.encontrado).toBe(false)
    expect(lineas[0]?.subtotal).toBeUndefined()
    expect(lineas[0]?.nota).toBe('a confirmar por el operador')
    expect(resumen.lineas_sin_precio).toBe(1)
    expect(resumen.subtotal).toBe(0)
  })
})

describe('precios con rango', () => {
  it('el peluche grande informa los dos límites y no calcula subtotal', async () => {
    const { lineas } = await cotizarPrendas([{ descripcion: 'peluche grande', cantidad: 1 }])

    expect(lineas[0]?.es_rango).toBe(true)
    expect(lineas[0]?.precio_min).toBe(5)
    expect(lineas[0]?.precio_max).toBe(7)
    expect(lineas[0]?.subtotal).toBeUndefined()
  })

  it('el peluche mediano tiene precio único y sí calcula', async () => {
    const { lineas } = await cotizarPrendas([{ descripcion: 'peluche mediano', cantidad: 2 }])
    expect(lineas[0]?.es_rango).toBeUndefined()
    expect(lineas[0]?.subtotal).toBe(6)
  })
})

describe('cuando varias prendas encajan', () => {
  it('"un edredón" pregunta cuál, en vez de adivinar', async () => {
    const { lineas, resumen } = await cotizarPrendas([{ descripcion: 'un edredon', cantidad: 1 }])

    expect(lineas[0]?.requiere_desambiguacion).toBe(true)
    expect(lineas[0]?.subtotal).toBeUndefined()
    expect(lineas[0]?.opciones?.length ?? 0).toBeGreaterThan(1)
    expect(resumen.requiere_respuesta_del_cliente).toBe(true)
  })

  it('"edredón 3 plazas" ya es inequívoco: 7.00', async () => {
    const { lineas } = await cotizarPrendas([{ descripcion: 'edredon 3 plazas', cantidad: 1 }])
    expect(lineas[0]?.nombre_item).toBe('Edredón 3 plazas')
    expect(lineas[0]?.subtotal).toBe(7)
  })
})

describe('unidades que no son piezas', () => {
  it('una cobija suelta cuesta 5.00, no el paquete entero', async () => {
    const { lineas } = await cotizarPrendas([{ descripcion: 'cobijas pequeñas', cantidad: 1 }])

    expect(lineas[0]?.paquetes_cobrados).toBe(0)
    expect(lineas[0]?.subtotal).toBe(5)
  })

  it('aplica la promoción 3 x 12.00 y cobra el sobrante suelto', async () => {
    const { lineas } = await cotizarPrendas([{ descripcion: 'cobijas pequeñas', cantidad: 5 }])

    expect(lineas[0]?.paquetes_cobrados).toBe(1)
    // 3 por 12.00 más 2 sueltas a 5.00.
    expect(lineas[0]?.subtotal).toBe(22)
    expect(lineas[0]?.nota).toContain('paquete(s) de 3')
  })

  it('cobra la ropa suelta por libra', async () => {
    const { lineas } = await cotizarPrendas([
      { descripcion: 'lavado secado y doblado', cantidad: 10 },
    ])
    expect(lineas[0]?.unidad).toBe('libra')
    expect(lineas[0]?.subtotal).toBe(7)
  })

  it('cobra la alfombra por metro cuadrado', async () => {
    const { lineas } = await cotizarPrendas([
      { descripcion: 'alfombra de pelo corto', cantidad: 4.5 },
    ])
    expect(lineas[0]?.unidad).toBe('m2')
    expect(lineas[0]?.subtotal).toBe(31.5)
  })
})

describe('el resumen', () => {
  it('siempre viaja como estimado pendiente de verificación', async () => {
    const { resumen } = await cotizarPrendas([
      { descripcion: '5 camisetas', cantidad: 5, metodo: 'agua' },
      { descripcion: '4 pantalones jean', cantidad: 4 },
      { descripcion: '1 chaqueta de lana', cantidad: 1 },
    ])
    expect(resumen.estado).toBe('estimado_pendiente_verificacion')
  })

  it('suma solo las líneas que tienen precio', async () => {
    // Bufanda y no chal: servicios.test.ts cambia el precio del chal mientras corre.
    const { resumen } = await cotizarPrendas([
      { descripcion: 'bufanda', cantidad: 2 },
      { descripcion: 'un kayak inflable', cantidad: 1 },
    ])
    expect(resumen.subtotal).toBe(6)
    expect(resumen.lineas_con_precio).toBe(1)
    expect(resumen.lineas_sin_precio).toBe(1)
  })
})

describe('errores de entrada', () => {
  it('lista vacía: ITEMS_VACIOS', async () => {
    await expect(cotizarPrendas([])).rejects.toMatchObject({ codigo: 'ITEMS_VACIOS' })
  })

  it('cantidad cero o negativa: CANTIDAD_INVALIDA', async () => {
    await expect(cotizarPrendas([{ descripcion: 'chal', cantidad: 0 }])).rejects.toMatchObject({
      codigo: 'CANTIDAD_INVALIDA',
    })
    await expect(cotizarPrendas([{ descripcion: 'chal', cantidad: -2 }])).rejects.toBeInstanceOf(
      ErrorCotizacion,
    )
  })
})

describe('es lectura pura', () => {
  it('cotizar no escribe nada en el catálogo', async () => {
    const antes = await supabaseAdmin()
      .from('servicios')
      .select('id', { count: 'exact', head: true })

    await cotizarPrendas([
      { descripcion: '3 camisetas', cantidad: 3, metodo: 'agua' },
      { descripcion: 'algo que no existe', cantidad: 1 },
    ])

    const despues = await supabaseAdmin()
      .from('servicios')
      .select('id', { count: 'exact', head: true })

    expect(despues.count).toBe(antes.count)
  })
})

describe('calcularVehiculo', () => {
  it('1 funda va en moto', () => {
    expect(calcularVehiculo(1)).toBe('moto')
  })

  it('más de 1 funda necesita auto', () => {
    expect(calcularVehiculo(2)).toBe('auto')
    expect(calcularVehiculo(9)).toBe('auto')
  })

  it('cero fundas no es un pedido', () => {
    expect(() => calcularVehiculo(0)).toThrow(ErrorCotizacion)
  })
})
