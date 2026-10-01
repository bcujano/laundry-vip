import { describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calcularVehiculo, cotizarPrendas, ErrorCotizacion } from '@/server/pricing/cotizar'
import { centavos, precioDe, servicioDe } from '../util/catalogo'

/**
 * Se cotiza contra el catálogo real de la planta, no contra uno de mentira, y
 * los precios esperados se leen de la base: el dueño los cambia en el CRM
 * cuando quiere y ninguna prueba puede quedarse con un número viejo escrito.
 */

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

  it('"3 camisetas" en agua cobra 3 veces el precio en agua', async () => {
    const precio = await precioDe('Camiseta', 'agua')
    const { lineas, resumen } = await cotizarPrendas([
      { descripcion: '3 camisetas', cantidad: 3, metodo: 'agua' },
    ])

    expect(lineas[0]?.precio_unitario).toBe(precio)
    expect(lineas[0]?.subtotal).toBe(centavos(3 * precio))
    expect(resumen.subtotal).toBe(centavos(3 * precio))
    expect(resumen.requiere_respuesta_del_cliente).toBe(false)
  })

  it('camisa o blusa también exige método, y con método cobra el de ese método', async () => {
    const sinMetodo = await cotizarPrendas([{ descripcion: '2 camisas', cantidad: 2 }])
    expect(sinMetodo.lineas[0]?.requiere_metodo).toBe(true)
    expect(sinMetodo.lineas[0]?.metodos_disponibles?.sort()).toEqual(['agua', 'planchado', 'seco'])

    const precio = await precioDe('Camisa o blusa', 'seco')
    const conMetodo = await cotizarPrendas([
      { descripcion: '2 camisas', cantidad: 2, metodo: 'seco' },
    ])
    expect(conMetodo.lineas[0]?.subtotal).toBe(centavos(2 * precio))
  })
})

describe('el método lo manda el catálogo', () => {
  it('un terno pedido «en agua» se cotiza en seco y se avisa', async () => {
    const terno = await servicioDe('Terno 3 piezas')
    const { lineas } = await cotizarPrendas([
      { descripcion: 'terno de 3 piezas', cantidad: 1, metodo: 'agua' },
    ])

    // Antes se quedaba sin precio; ahora cotiza con el método real.
    expect(lineas[0]?.metodo).toBe(terno.metodo)
    expect(lineas[0]?.subtotal).toBe(Number(terno.precio_min))
    expect(lineas[0]?.advertencia).toContain(terno.metodo)
  })

  it('una prenda de un solo método viaja marcada como método único', async () => {
    const { lineas } = await cotizarPrendas([{ descripcion: 'mantel grande', cantidad: 1 }])
    expect(lineas[0]?.metodo_unico).toBe(true)
  })

  it('una prenda de varios métodos no se marca como única', async () => {
    const { lineas } = await cotizarPrendas([
      { descripcion: 'camiseta', cantidad: 1, metodo: 'agua' },
    ])
    expect(lineas[0]?.metodo_unico).toBe(false)
    expect(lineas[0]?.advertencia).toBeUndefined()
  })
})

describe('nunca se le niega un servicio al cliente', () => {
  it('lo que no encaja llega con sugerencias, no con un no', async () => {
    const { lineas } = await cotizarPrendas([
      { descripcion: 'una manta de bebe muy suave', cantidad: 1 },
    ])

    expect(lineas[0]?.encontrado).toBe(false)
    expect(lineas[0]?.sugerencias?.length ?? 0).toBeGreaterThan(0)
    expect(lineas[0]?.nota).toContain('nunca digas que no se ofrece')
  })

  it('y cuando no hay ni parecidos, la nota manda confirmar con planta', async () => {
    const { lineas } = await cotizarPrendas([{ descripcion: 'un kayak inflable', cantidad: 1 }])

    expect(lineas[0]?.encontrado).toBe(false)
    expect(lineas[0]?.nota).toContain('NO digas que no se ofrece')
  })

  it('las palabras con las que se pregunta ya no esconden la prenda', async () => {
    // Los dos casos exactos que fallaron con clientes reales.
    const { lineas } = await cotizarPrendas([
      { descripcion: 'hacen tintura', cantidad: 1 },
      { descripcion: 'lavado de zapatos', cantidad: 1 },
    ])

    expect(lineas[0]?.nombre_item).toBe('Tinturado')
    expect(lineas[0]?.subtotal).toBeGreaterThan(0)
    expect(lineas[1]?.nombre_item).toBe('Zapatos deportivos')
    expect(lineas[1]?.subtotal).toBeGreaterThan(0)
  })
})

describe('lo que no está en el catálogo', () => {
  it('va sin precio y con la nota, nunca con un precio inventado', async () => {
    const { lineas, resumen } = await cotizarPrendas([
      { descripcion: 'un kayak inflable', cantidad: 1 },
    ])

    expect(lineas[0]?.encontrado).toBe(false)
    expect(lineas[0]?.subtotal).toBeUndefined()
    expect(lineas[0]?.nota).toContain('a confirmar por el operador')
    expect(resumen.lineas_sin_precio).toBe(1)
    expect(resumen.subtotal).toBe(0)
  })
})

describe('precios con rango', () => {
  it('el peluche grande informa los dos límites y no calcula subtotal', async () => {
    const servicio = await servicioDe('Peluche grande')
    const { lineas } = await cotizarPrendas([{ descripcion: 'peluche grande', cantidad: 1 }])

    expect(lineas[0]?.es_rango).toBe(true)
    expect(lineas[0]?.precio_min).toBe(Number(servicio.precio_min))
    expect(lineas[0]?.precio_max).toBe(Number(servicio.precio_max))
    expect(lineas[0]?.subtotal).toBeUndefined()
  })

  it('el peluche mediano tiene precio único y sí calcula', async () => {
    const precio = await precioDe('Peluche mediano')
    const { lineas } = await cotizarPrendas([{ descripcion: 'peluche mediano', cantidad: 2 }])
    expect(lineas[0]?.es_rango).toBeUndefined()
    expect(lineas[0]?.subtotal).toBe(centavos(2 * precio))
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

  it('"edredón 3 plazas" ya es inequívoco', async () => {
    const precio = await precioDe('Edredón 3 plazas')
    const { lineas } = await cotizarPrendas([{ descripcion: 'edredon 3 plazas', cantidad: 1 }])
    expect(lineas[0]?.nombre_item).toBe('Edredón 3 plazas')
    expect(lineas[0]?.subtotal).toBe(precio)
  })
})

describe('unidades que no son piezas', () => {
  it('una prenda con promoción, suelta, cuesta el precio suelto y no el paquete', async () => {
    const cobijas = await servicioDe('Cobijas pequeñas')
    const { lineas } = await cotizarPrendas([{ descripcion: 'cobijas pequeñas', cantidad: 1 }])

    expect(lineas[0]?.paquetes_cobrados).toBe(0)
    expect(lineas[0]?.subtotal).toBe(Number(cobijas.precio_min))
  })

  it('aplica la promoción por cantidad y cobra el sobrante suelto', async () => {
    const cobijas = await servicioDe('Cobijas pequeñas')
    const porPaquete = cobijas.cantidad_por_paquete ?? 0
    const precioPaquete = Number(cobijas.precio_paquete)
    if (porPaquete < 2 || !precioPaquete) throw new Error('Las cobijas ya no tienen promoción')

    // Un paquete completo más una prenda suelta: el sobrante nunca se redondea.
    const cantidad = porPaquete + 1
    const { lineas } = await cotizarPrendas([{ descripcion: 'cobijas pequeñas', cantidad }])

    expect(lineas[0]?.paquetes_cobrados).toBe(1)
    expect(lineas[0]?.subtotal).toBe(centavos(precioPaquete + Number(cobijas.precio_min)))
    expect(lineas[0]?.nota).toContain(`paquete(s) de ${porPaquete}`)
  })

  it('cobra la ropa suelta por libra', async () => {
    const precio = await precioDe('Lavado, secado y doblado')
    const { lineas } = await cotizarPrendas([
      { descripcion: 'lavado secado y doblado', cantidad: 10 },
    ])
    expect(lineas[0]?.unidad).toBe('libra')
    expect(lineas[0]?.subtotal).toBe(centavos(10 * precio))
  })

  it('cobra la alfombra por metro cuadrado', async () => {
    const precio = await precioDe('Alfombra de pelo corto')
    const { lineas } = await cotizarPrendas([
      { descripcion: 'alfombra de pelo corto', cantidad: 4.5 },
    ])
    expect(lineas[0]?.unidad).toBe('m2')
    expect(lineas[0]?.subtotal).toBe(centavos(4.5 * precio))
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
    const precio = await precioDe('Bufanda')
    const { resumen } = await cotizarPrendas([
      { descripcion: 'bufanda', cantidad: 2 },
      { descripcion: 'un kayak inflable', cantidad: 1 },
    ])
    expect(resumen.subtotal).toBe(centavos(2 * precio))
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
  it('siempre es auto, sin importar cuántas fundas sean (decisión del 2026-10-01)', () => {
    expect(calcularVehiculo(1)).toBe('auto')
    expect(calcularVehiculo(2)).toBe('auto')
    expect(calcularVehiculo(9)).toBe('auto')
    expect(calcularVehiculo()).toBe('auto')
  })
})
