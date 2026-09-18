import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { consultaAdmin, resumenDiario } from '@/server/webhook/handlers/admin'
import { registrarClientePresencial } from '@/server/webhook/handlers/operador'
import {
  avanzarEstadoPlanta,
  buscarPedidos,
  registrarConteo,
} from '@/server/webhook/handlers/planta'
import { ACCIONES } from '@/server/webhook/schemas'
import { corrida } from '../util/corrida.ts'

/**
 * Dos niveles en la lista blanca. Operador: planta. Admin: planta + lectura del
 * negocio. Nadie mueve dinero por WhatsApp. Todos los números son propios de
 * la corrida: la lista blanca real no se toca.
 */
const CORRIDA = corrida()
const PREFIJO = `+5939${CORRIDA}`
const OPERADOR = `${PREFIJO}81`
const ADMIN = `${PREFIJO}82`
const CLIENTE = `${PREFIJO}83`
const NOMBRE = `Hotel Prueba ${CORRIDA}`

beforeAll(async () => {
  await supabaseAdmin()
    .from('operador_whitelist')
    .insert([
      { telefono: OPERADOR, nombre: `Operador ${CORRIDA}`, nivel: 'operador' },
      { telefono: ADMIN, nombre: `Admin ${CORRIDA}`, nivel: 'admin' },
    ])
})

afterAll(async () => {
  const cliente = supabaseAdmin()
  await cliente.from('operador_whitelist').delete().in('telefono', [OPERADOR, ADMIN])
  const { data } = await cliente.from('clientes').select('id').like('telefono', `${PREFIJO}%`)
  for (const fila of data ?? []) await cliente.from('pedidos').delete().eq('cliente_id', fila.id)
  await cliente.from('clientes').delete().like('telefono', `${PREFIJO}%`)
  await cliente.from('conversaciones').delete().in('telefono', [OPERADOR, ADMIN])
})

describe('nada de dinero por WhatsApp', () => {
  it('confirmar pagos y corregir montos ya no existen como acciones del agente', () => {
    expect(ACCIONES).not.toContain('confirmar_pago')
    expect(ACCIONES).not.toContain('corregir_cotizacion')
  })
})

describe('operador de planta', () => {
  let pedidoId = ''

  it('registra, encuentra el pedido por el nombre y lo avanza', async () => {
    const alta = await registrarClientePresencial({
      telefono_operador: OPERADOR,
      telefono_cliente: CLIENTE,
      nombre_negocio: NOMBRE,
      items: [
        { descripcion: 'camiseta', cantidad: 5, metodo: 'agua' },
        { descripcion: 'duvet', cantidad: 2 },
      ],
    })
    if (!alta.ok) throw new Error('no se registró la orden')
    pedidoId = (alta.data as { pedido_id: string }).pedido_id

    const busqueda = await buscarPedidos({
      telefono_operador: OPERADOR,
      texto: NOMBRE.slice(0, 12),
    })
    expect(busqueda.ok).toBe(true)
    if (!busqueda.ok) return
    const encontrados = (busqueda.data as { pedidos: { pedido_id: string }[] }).pedidos
    expect(encontrados.map((p) => p.pedido_id)).toContain(pedidoId)

    const recolectado = await avanzarEstadoPlanta({
      telefono_operador: OPERADOR,
      pedido_id: pedidoId,
      estado: 'recolectado',
    })
    expect(recolectado).toMatchObject({ ok: true, data: { estado: 'recolectado' } })
  })

  it('un conteo que no cuadra congela el pedido y deja rastro de quién contó', async () => {
    // Sin pedido_id: usa el último que tocó este operador.
    const conteo = await registrarConteo({
      telefono_operador: OPERADOR,
      conteos: [
        { descripcion: 'camisetas', cantidad: 4 },
        { descripcion: 'duvet', cantidad: 2 },
      ],
    })
    expect(conteo).toMatchObject({
      ok: true,
      data: { pedido_id: pedidoId, hay_discrepancia: true, estado: 'discrepancia_detectada' },
    })

    const { data: eventos } = await supabaseAdmin()
      .from('pedido_eventos')
      .select('motivo')
      .eq('pedido_id', pedidoId)
    expect(eventos?.some((e) => String(e.motivo).includes(OPERADOR))).toBe(true)

    // Congelado: por WhatsApp no avanza; se resuelve en el CRM.
    const avance = await avanzarEstadoPlanta({
      telefono_operador: OPERADOR,
      pedido_id: pedidoId,
      estado: 'en_proceso',
    })
    expect(avance.ok).toBe(false)
  })

  it('un conteo incompleto dice qué falta en vez de adivinar', async () => {
    const conteo = await registrarConteo({
      telefono_operador: OPERADOR,
      pedido_id: pedidoId,
      conteos: [{ descripcion: 'camisetas', cantidad: 5 }],
    })
    expect(conteo.ok).toBe(false)
    if (conteo.ok) return
    expect(conteo.mensaje).toContain('Falta contar')
  })

  it('un operador no puede pedir lo de administrador', async () => {
    const intento = await consultaAdmin({ telefono_operador: OPERADOR, consulta: 'resumen' })
    expect(intento).toMatchObject({ ok: false, codigo: 'OPERADOR_NO_AUTORIZADO' })
  })
})

describe('administrador', () => {
  it('puede hacer lo del operador y además consultar el negocio', async () => {
    const busqueda = await buscarPedidos({ telefono_operador: ADMIN, texto: NOMBRE.slice(0, 12) })
    expect(busqueda.ok).toBe(true)

    for (const consulta of [
      'resumen',
      'atencion',
      'cola_manana',
      'leads_calientes',
      'clientes_top',
    ] as const) {
      const respuesta = await consultaAdmin({ telefono_operador: ADMIN, consulta })
      expect(respuesta.ok, consulta).toBe(true)
    }
  })

  it('el resumen de las 8:00 trae a quién mandárselo', async () => {
    const respuesta = await resumenDiario(undefined)
    expect(respuesta.ok).toBe(true)
    if (!respuesta.ok) return
    const datos = respuesta.data as { admins: { telefono: string }[]; recolecciones_hoy: number }
    expect(datos.admins.map((a) => a.telefono)).toContain(ADMIN)
    expect(typeof datos.recolecciones_hoy).toBe('number')
  })
})
