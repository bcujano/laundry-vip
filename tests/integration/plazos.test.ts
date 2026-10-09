import { describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { cotizarPrendas } from '@/server/pricing/cotizar'
import { plazoLegible } from '@/server/pricing/plazo'

/** El plazo lo fija cada servicio en el CRM; se compara contra la base y no contra un número escrito. */
async function plazoEnBase(nombre: string, metodo: string): Promise<number> {
  const { data } = await supabaseAdmin()
    .from('servicios')
    .select('plazo_horas')
    .eq('nombre_item', nombre)
    .eq('metodo', metodo)
    .single()
  return (data as { plazo_horas: number }).plazo_horas
}

describe('cotizar_prendas trae el plazo de entrega de cada servicio', () => {
  it('un terno y la ropa por libra traen el plazo que tienen en el CRM', async () => {
    const { lineas, resumen } = await cotizarPrendas([
      { descripcion: 'terno 2 piezas', cantidad: 3 },
      { descripcion: 'lavado secado y doblado', cantidad: 10 },
    ])
    const terno = await plazoEnBase('Terno 2 piezas', 'seco')
    const libra = await plazoEnBase('Lavado, secado y doblado', 'agua')

    expect(lineas[0]?.plazo_horas).toBe(terno)
    expect(lineas[0]?.plazo).toBe(plazoLegible(terno))
    expect(lineas[1]?.plazo_horas).toBe(libra)
    // Con plazos distintos el resumen trae el más largo y avisa que hay que decir cada uno.
    expect(resumen.plazo_entrega_horas).toBe(Math.max(terno, libra))
    expect(resumen.plazos_distintos).toBe(terno !== libra)
  })

  it('una prenda que no se encontró no inventa un plazo', async () => {
    const { lineas, resumen } = await cotizarPrendas([
      { descripcion: 'zzzxqw inexistente', cantidad: 1 },
    ])
    expect(lineas[0]?.plazo_horas).toBeUndefined()
    expect(resumen.plazo_entrega).toBeNull()
  })
})
