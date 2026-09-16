import { supabaseAdmin } from '@/lib/supabase/admin'
import { limitesDelDia } from '@/server/scheduling/ventana'
import type { EstadoPedido } from '@/types/database'

/**
 * Los números del tablero de inicio.
 * Todo en una pasada: el panel se abre decenas de veces al día y no tiene
 * sentido hacer diez consultas para pintar cuatro tarjetas.
 */

export type ResumenPedido = {
  id: string
  estado: EstadoPedido
  cliente: string
  telefono: string
  monto: number | null
  ventana: string | null
  discrepancia: boolean
  creado: string
}

export type Tablero = {
  pedidosHoy: number
  sinAtender: number
  enPlanta: number
  clientes: number
  facturadoMes: number
  estimadoMes: number
  porEstado: { estado: EstadoPedido; total: number }[]
  requierenAtencion: {
    discrepancias: ResumenPedido[]
    esperandoPago: ResumenPedido[]
    sinVerificar: ResumenPedido[]
  }
  colaDeHoy: ResumenPedido[]
}

type FilaCruda = {
  id: string
  estado: EstadoPedido
  monto_confirmado_lavado: number | null
  monto_estimado_lavado: number | null
  ventana_recoleccion_inicio: string | null
  discrepancia_detectada: boolean
  created_at: string
  cliente: {
    nombre_negocio: string | null
    nombre_contacto: string | null
    telefono: string
  } | null
}

const SELECCION =
  'id, estado, monto_confirmado_lavado, monto_estimado_lavado, ventana_recoleccion_inicio, discrepancia_detectada, created_at, cliente:clientes(nombre_negocio, nombre_contacto, telefono)'

function resumir(fila: FilaCruda): ResumenPedido {
  return {
    id: fila.id,
    estado: fila.estado,
    cliente:
      fila.cliente?.nombre_negocio ||
      fila.cliente?.nombre_contacto ||
      fila.cliente?.telefono ||
      '—',
    telefono: fila.cliente?.telefono ?? '',
    monto: fila.monto_confirmado_lavado ?? fila.monto_estimado_lavado,
    ventana: fila.ventana_recoleccion_inicio,
    discrepancia: fila.discrepancia_detectada,
    creado: fila.created_at,
  }
}

const NO_FACTURAN = new Set<EstadoPedido>(['cancelado', 'recoleccion_fallida'])
const CERRADOS = new Set<EstadoPedido>(['entregado', 'cancelado', 'recoleccion_fallida'])

export async function tablero(ahora = new Date()): Promise<Tablero> {
  const cliente = supabaseAdmin()
  const { desde, hasta } = limitesDelDia(ahora)
  const haceUnMes = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [pedidosMes, deHoy, totalClientes] = await Promise.all([
    cliente.from('pedidos').select(SELECCION).gte('created_at', haceUnMes.toISOString()),
    cliente
      .from('pedidos')
      .select(SELECCION)
      .gte('ventana_recoleccion_inicio', desde.toISOString())
      .lt('ventana_recoleccion_inicio', hasta.toISOString())
      .order('ventana_recoleccion_inicio', { ascending: true }),
    cliente.from('clientes').select('id', { count: 'exact', head: true }),
  ])

  const filasMes = (pedidosMes.data ?? []) as unknown as FilaCruda[]
  const filasHoy = (deHoy.data ?? []) as unknown as FilaCruda[]

  const conteo = new Map<EstadoPedido, number>()
  let facturado = 0
  let estimado = 0

  for (const fila of filasMes) {
    conteo.set(fila.estado, (conteo.get(fila.estado) ?? 0) + 1)
    if (NO_FACTURAN.has(fila.estado)) continue
    if (fila.monto_confirmado_lavado !== null) facturado += Number(fila.monto_confirmado_lavado)
    else estimado += Number(fila.monto_estimado_lavado ?? 0)
  }

  const abiertos = filasMes.filter((fila) => !CERRADOS.has(fila.estado))

  return {
    pedidosHoy: filasHoy.length,
    sinAtender: filasHoy.filter((fila) => fila.estado === 'nuevo').length,
    enPlanta: abiertos.filter((fila) => fila.estado === 'en_proceso').length,
    clientes: totalClientes.count ?? 0,
    facturadoMes: Math.round(facturado * 100) / 100,
    estimadoMes: Math.round(estimado * 100) / 100,
    porEstado: [...conteo.entries()]
      .map(([estado, total]) => ({ estado, total }))
      .sort((a, b) => b.total - a.total),
    requierenAtencion: {
      discrepancias: abiertos.filter((fila) => fila.discrepancia_detectada).map(resumir),
      esperandoPago: abiertos
        .filter(
          (fila) =>
            fila.estado === 'esperando_pago_para_recoleccion' ||
            fila.estado === 'esperando_pago_para_entrega',
        )
        .map(resumir),
      sinVerificar: abiertos
        .filter((fila) => fila.estado === 'recolectado' && !fila.discrepancia_detectada)
        .map(resumir),
    },
    colaDeHoy: filasHoy.map(resumir),
  }
}
