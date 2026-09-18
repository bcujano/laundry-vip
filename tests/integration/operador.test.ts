import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { actualizarRegistro, registrarClientePresencial } from '@/server/webhook/handlers/operador'
import { corrida } from '../util/corrida.ts'

const INTRUSO = '+593999888777'
const CORRIDA = corrida()
const PREFIJO = `+5939${CORRIDA}`
// Operador propio de la corrida: la base es la real y la lista blanca tiene
// números de verdad. Nunca se usa ni se limpia la conversación de uno de ellos.
const OPERADOR = `${PREFIJO}99`

let indice = 0
function nuevoTelefono(): string {
  indice += 1
  return `${PREFIJO}${String(indice).padStart(2, '0')}`
}

const ITEMS = [{ descripcion: '5 camisetas', cantidad: 5, metodo: 'agua' as const }]

beforeAll(async () => {
  await supabaseAdmin()
    .from('operador_whitelist')
    .insert({ telefono: OPERADOR, nombre: `Operador de prueba ${CORRIDA}`, activo: true })
})

afterAll(async () => {
  const cliente = supabaseAdmin()
  await cliente.from('operador_whitelist').delete().eq('telefono', OPERADOR)
  const { data } = await cliente.from('clientes').select('id').like('telefono', `${PREFIJO}%`)
  for (const fila of data ?? []) {
    await cliente.from('pedidos').delete().eq('cliente_id', fila.id)
  }
  await cliente.from('clientes').delete().like('telefono', `${PREFIJO}%`)
  await cliente.from('conversaciones').delete().eq('telefono', OPERADOR)
})

describe('lista blanca', () => {
  it('un número que no es operador no puede registrar nada', async () => {
    const resultado = await registrarClientePresencial({
      telefono_operador: INTRUSO,
      telefono_cliente: nuevoTelefono(),
      items: ITEMS,
    })
    expect(resultado).toMatchObject({ ok: false, codigo: 'OPERADOR_NO_AUTORIZADO' })
  })
})

describe('registro presencial por voz', () => {
  it('nace sin logística y con el estimado calculado', async () => {
    const resultado = await registrarClientePresencial({
      telefono_operador: OPERADOR,
      telefono_cliente: nuevoTelefono(),
      nombre_contacto: 'Doña Rosa',
      items: ITEMS,
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    const data = resultado.data as { pedido_id: string; monto_estimado_lavado: number }
    expect(data.monto_estimado_lavado).toBe(11.25)

    const { data: pedido } = await supabaseAdmin()
      .from('pedidos')
      .select('*')
      .eq('id', data.pedido_id)
      .single()

    expect(pedido?.canal).toBe('presencial')
    expect(pedido?.direccion_recoleccion).toBeNull()
    expect(pedido?.vehiculo_sugerido).toBeNull()
    expect(pedido?.numero_fundas).toBeNull()
  })

  it('avisa cuando el teléfono dictado ya es de otro cliente', async () => {
    const telefono = nuevoTelefono()
    await registrarClientePresencial({
      telefono_operador: OPERADOR,
      telefono_cliente: telefono,
      nombre_contacto: 'Juan Pérez',
      items: ITEMS,
    })

    const segundo = await registrarClientePresencial({
      telefono_operador: OPERADOR,
      telefono_cliente: telefono,
      nombre_contacto: 'Iván Ubillús',
      items: ITEMS,
    })

    expect(segundo.ok).toBe(true)
    if (!segundo.ok) return
    expect(segundo.data).toMatchObject({
      cliente_creado: false,
      nombre_cliente: 'Juan Pérez',
      telefono_de_otro_cliente: true,
    })
  })

  it('exige el teléfono del cliente', async () => {
    const resultado = await registrarClientePresencial({
      telefono_operador: OPERADOR,
      items: ITEMS,
    })
    expect(resultado).toMatchObject({ ok: false, codigo: 'PARAMETROS_INVALIDOS' })
  })
})

describe('corrección del registro', () => {
  it('actualiza el mismo pedido en vez de duplicarlo', async () => {
    const telefonoCliente = nuevoTelefono()
    const alta = await registrarClientePresencial({
      telefono_operador: OPERADOR,
      telefono_cliente: telefonoCliente,
      items: ITEMS,
    })
    expect(alta.ok).toBe(true)
    if (!alta.ok) return
    const { pedido_id, cliente_id } = alta.data as { pedido_id: string; cliente_id: string }

    // "Corrige: eran 4, no 5" — sin pedido_id, usa el último de la conversación.
    const correccion = await actualizarRegistro({
      telefono_operador: OPERADOR,
      items: [{ descripcion: '4 camisetas', cantidad: 4, metodo: 'agua' }],
    })

    expect(correccion.ok).toBe(true)
    if (!correccion.ok) return
    const datos = correccion.data as { pedido_id: string; monto_estimado_lavado: number }
    expect(datos.pedido_id).toBe(pedido_id)
    expect(datos.monto_estimado_lavado).toBe(9)

    // Sigue habiendo UN pedido, no dos.
    const { data: pedidos } = await supabaseAdmin()
      .from('pedidos')
      .select('id')
      .eq('cliente_id', cliente_id)
    expect(pedidos).toHaveLength(1)

    // Y UNA prenda declarada, la corregida.
    const { data: prendas } = await supabaseAdmin()
      .from('pedido_items')
      .select('cantidad')
      .eq('pedido_id', pedido_id)
      .eq('origen', 'declarado')
    expect(prendas).toHaveLength(1)
    expect(Number(prendas?.[0]?.cantidad)).toBe(4)
  })

  it('corrige también el nombre del cliente', async () => {
    const telefonoCliente = nuevoTelefono()
    const alta = await registrarClientePresencial({
      telefono_operador: OPERADOR,
      telefono_cliente: telefonoCliente,
      nombre_contacto: 'Nombre mal dictado',
      items: ITEMS,
    })
    if (!alta.ok) throw new Error('no se creó')
    const { cliente_id, pedido_id } = alta.data as { cliente_id: string; pedido_id: string }

    await actualizarRegistro({
      telefono_operador: OPERADOR,
      pedido_id,
      nombre_contacto: 'Rosa Elena Pérez',
    })

    const { data } = await supabaseAdmin()
      .from('clientes')
      .select('nombre_contacto')
      .eq('id', cliente_id)
      .single()
    expect(data?.nombre_contacto).toBe('Rosa Elena Pérez')
  })
})
