import { tipoNegocioLegible } from '@/lib/format'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Cliente, Pedido, PedidoItem } from '@/types/database'
import { aCsv, fechaCsv } from './csv'

/**
 * Descarga completa de clientes y pedidos. Se lee en páginas de 1000 porque
 * Supabase corta ahí cada consulta: sin esto, el archivo saldría incompleto
 * en cuanto el negocio crezca.
 */

const PAGINA = 1000

async function todas<T>(tabla: string, seleccion: string, orden = 'created_at'): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabaseAdmin()
      .from(tabla)
      .select(seleccion)
      .order(orden, { ascending: false })
      .range(desde, desde + PAGINA - 1)
    if (error) throw new Error(`No se pudo leer ${tabla}: ${error.message}`)
    filas.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGINA) return filas
  }
}

const legible = (valor: string | null | undefined) => (valor ?? '').replaceAll('_', ' ')

type ClienteConPedidos = Cliente & {
  pedidos: {
    created_at: string
    estado: string
    monto_confirmado_lavado: number | null
    monto_estimado_lavado: number | null
  }[]
}

export async function csvClientes(): Promise<string> {
  const clientes = await todas<ClienteConPedidos>(
    'clientes',
    '*, pedidos(created_at, estado, monto_confirmado_lavado, monto_estimado_lavado)',
  )

  return aCsv(clientes, [
    { titulo: 'Negocio', valor: (c) => c.nombre_negocio },
    { titulo: 'Contacto', valor: (c) => c.nombre_contacto },
    { titulo: 'Teléfono', valor: (c) => c.telefono },
    { titulo: 'Tipo', valor: (c) => tipoNegocioLegible(c.tipo_negocio) },
    { titulo: 'Canal de origen', valor: (c) => legible(c.canal_origen) },
    { titulo: 'Facturación', valor: (c) => legible(c.modelo_facturacion) },
    { titulo: 'Saldo acumulado USD', valor: (c) => Number(c.saldo_acumulado) },
    { titulo: 'Pedidos', valor: (c) => c.pedidos.length },
    {
      titulo: 'Facturado verificado USD',
      valor: (c) =>
        Math.round(
          c.pedidos
            .filter((p) => p.estado !== 'cancelado' && p.estado !== 'recoleccion_fallida')
            .reduce((suma, p) => suma + Number(p.monto_confirmado_lavado ?? 0), 0) * 100,
        ) / 100,
    },
    {
      titulo: 'Último pedido',
      valor: (c) =>
        fechaCsv(
          c.pedidos
            .map((p) => p.created_at)
            .sort()
            .at(-1),
        ),
    },
    {
      titulo: 'Aviso de privacidad enviado',
      valor: (c) => fechaCsv(c.aviso_privacidad_enviado_en),
    },
    { titulo: 'Cliente desde', valor: (c) => fechaCsv(c.created_at) },
  ])
}

type PedidoConTodo = Pedido & {
  cliente: Pick<Cliente, 'nombre_negocio' | 'nombre_contacto' | 'telefono' | 'tipo_negocio'> | null
  items: Pick<PedidoItem, 'origen' | 'descripcion' | 'cantidad' | 'metodo_elegido'>[]
}

/** Las prendas en una celda: «5 Camiseta (agua) · 2 Duvet». Cuenta lo verificado si lo hay. */
function prendas(items: PedidoConTodo['items']): string {
  const verificados = items.filter((i) => i.origen === 'verificado')
  const lista = verificados.length > 0 ? verificados : items.filter((i) => i.origen === 'declarado')
  return lista
    .map((i) => {
      const metodo =
        i.metodo_elegido && i.metodo_elegido !== 'unico' ? ` (${i.metodo_elegido})` : ''
      return `${Number(i.cantidad)} ${i.descripcion}${metodo}`
    })
    .join(' · ')
}

export async function csvPedidos(): Promise<string> {
  const pedidos = await todas<PedidoConTodo>(
    'pedidos',
    '*, cliente:clientes(nombre_negocio, nombre_contacto, telefono, tipo_negocio), items:pedido_items(origen, descripcion, cantidad, metodo_elegido)',
  )

  return aCsv(pedidos, [
    { titulo: 'Fecha', valor: (p) => fechaCsv(p.created_at) },
    { titulo: 'Pedido', valor: (p) => p.id },
    {
      titulo: 'Cliente',
      valor: (p) => p.cliente?.nombre_negocio || p.cliente?.nombre_contacto || '',
    },
    { titulo: 'Teléfono', valor: (p) => p.cliente?.telefono },
    {
      titulo: 'Tipo de cliente',
      valor: (p) => (p.cliente ? tipoNegocioLegible(p.cliente.tipo_negocio) : ''),
    },
    { titulo: 'Canal', valor: (p) => legible(p.canal) },
    { titulo: 'Estado', valor: (p) => legible(p.estado) },
    { titulo: 'Prendas', valor: (p) => prendas(p.items) },
    { titulo: 'Entrega', valor: (p) => legible(p.tipo_entrega) },
    { titulo: 'Estimado lavado USD', valor: (p) => p.monto_estimado_lavado },
    { titulo: 'Confirmado lavado USD', valor: (p) => p.monto_confirmado_lavado },
    { titulo: 'Combo USD', valor: (p) => p.monto_recoleccion_entrega },
    { titulo: 'Recolección USD', valor: (p) => p.monto_recoleccion },
    { titulo: 'Entrega USD', valor: (p) => p.monto_entrega },
    { titulo: 'Pago lavado', valor: (p) => legible(p.pago_lavado) },
    { titulo: 'Fundas', valor: (p) => p.numero_fundas },
    { titulo: 'Vehículo', valor: (p) => p.vehiculo_sugerido },
    { titulo: 'Dirección de recolección', valor: (p) => p.direccion_recoleccion },
    { titulo: 'Ventana de recolección', valor: (p) => fechaCsv(p.ventana_recoleccion_inicio) },
    { titulo: 'Discrepancia', valor: (p) => p.discrepancia_detectada },
    { titulo: 'Motivo de discrepancia', valor: (p) => p.discrepancia_motivo },
  ])
}
