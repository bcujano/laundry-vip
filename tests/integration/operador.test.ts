import { afterAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  actualizarRegistro,
  confirmarPagoOperador,
  corregirCotizacionOperador,
  registrarClientePresencial,
} from '@/server/webhook/handlers/operador'
import { corrida } from '../util/corrida.ts'

const OPERADOR = '+593963987124'
const INTRUSO = '+593999888777'
const CORRIDA = corrida()
const PREFIJO = `+5939${CORRIDA}`

let indice = 0
function nuevoTelefono(): string {
  indice += 1
  return `${PREFIJO}${String(indice).padStart(2, '0')}`
}

const ITEMS = [{ descripcion: '5 camisetas', cantidad: 5, metodo: 'agua' as const }]

afterAll(async () => {
  const cliente = supabaseAdmin()
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

  it('tampoco puede confirmar pagos ni corregir cotizaciones', async () => {
    const pago = await confirmarPagoOperador({
      telefono_operador: INTRUSO,
      pedido_id: '11111111-1111-4111-8111-111111111111',
      tramo: 'lavado',
    })
    expect(pago).toMatchObject({ ok: false, codigo: 'OPERADOR_NO_AUTORIZADO' })

    const correccion = await corregirCotizacionOperador({
      telefono_operador: INTRUSO,
      pedido_id: '11111111-1111-4111-8111-111111111111',
      monto_corregido: 10,
      motivo: 'porque sí',
    })
    expect(correccion).toMatchObject({ ok: false, codigo: 'OPERADOR_NO_AUTORIZADO' })
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

describe('pagos y correcciones desde WhatsApp', () => {
  it('confirmar_pago saca al pedido del estado de espera', async () => {
    const telefonoCliente = nuevoTelefono()
    const { data: cliente } = await supabaseAdmin()
      .from('clientes')
      .insert({ telefono: telefonoCliente, canal_origen: 'whatsapp_agente' })
      .select('id')
      .single()

    const { data: pedido } = await supabaseAdmin()
      .from('pedidos')
      .insert({
        cliente_id: cliente?.id,
        canal: 'whatsapp_agente',
        tipo_entrega: 'a_la_carta',
        estado: 'esperando_pago_para_recoleccion',
        metodo_transporte_recoleccion: 'app',
        pago_recoleccion: 'pendiente',
        monto_recoleccion: 3.5,
      })
      .select('id')
      .single()

    const resultado = await confirmarPagoOperador({
      telefono_operador: OPERADOR,
      pedido_id: pedido?.id as string,
      tramo: 'recoleccion',
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    const datos = resultado.data as { estado: string; despacho_liberado: boolean }
    expect(datos.estado).toBe('nuevo')
    expect(datos.despacho_liberado).toBe(true)
  })

  it('corregir_cotizacion pide notificar y el monto viejo ya no se cobra', async () => {
    const telefonoCliente = nuevoTelefono()
    const alta = await registrarClientePresencial({
      telefono_operador: OPERADOR,
      telefono_cliente: telefonoCliente,
      items: ITEMS,
    })
    if (!alta.ok) throw new Error('no se creó')
    const { pedido_id } = alta.data as { pedido_id: string }

    const resultado = await corregirCotizacionOperador({
      telefono_operador: OPERADOR,
      pedido_id,
      monto_corregido: 15.5,
      motivo: 'Vinieron 2 chompas que no estaban en la lista',
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    const datos = resultado.data as {
      monto_anterior: number
      monto_corregido: number
      notificar_cliente: boolean
      pedido_congelado: boolean
    }
    expect(datos.monto_anterior).toBe(11.25)
    expect(datos.monto_corregido).toBe(15.5)
    expect(datos.notificar_cliente).toBe(true)
    expect(datos.pedido_congelado).toBe(true)

    const { data: pedido } = await supabaseAdmin()
      .from('pedidos')
      .select('*')
      .eq('id', pedido_id)
      .single()

    // El monto que manda es el corregido, y el pedido queda congelado.
    expect(Number(pedido?.monto_confirmado_lavado)).toBe(15.5)
    expect(pedido?.discrepancia_detectada).toBe(true)
    expect(pedido?.estado).toBe('discrepancia_detectada')

    const { data: auditoria } = await supabaseAdmin()
      .from('correcciones_cotizacion')
      .select('*')
      .eq('pedido_id', pedido_id)
    expect(auditoria).toHaveLength(1)
    expect(auditoria?.[0]?.notificado_cliente).toBe(false)
  })

  it('un pedido inexistente devuelve NO_ENCONTRADO', async () => {
    const resultado = await confirmarPagoOperador({
      telefono_operador: OPERADOR,
      pedido_id: '11111111-1111-4111-8111-111111111111',
      tramo: 'lavado',
    })
    expect(resultado).toMatchObject({ ok: false, codigo: 'NO_ENCONTRADO' })
  })
})
