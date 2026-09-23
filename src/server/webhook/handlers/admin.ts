import { supabaseAdmin } from '@/lib/supabase/admin'
import { embudoLeads } from '@/server/dashboard/leads'
import { tablero } from '@/server/dashboard/repo'
import { comoVamos } from '@/server/reportes/negocio'
import { generar } from '@/server/reportes/repo'
import { limitesDelDia } from '@/server/scheduling/ventana'
import { exito, type ResultadoAccion } from '../respuesta'
import type { ParametrosDe } from '../schemas'
import { exigirNivel } from './permisos'

/**
 * Lo que un administrador pide por WhatsApp: lectura del negocio, nunca
 * escritura de dinero. Son las mismas cifras del dashboard del CRM.
 */

const DIA = 24 * 60 * 60 * 1000
const redondear = (n: number) => Math.round(n * 100) / 100

type Resumen = {
  fecha: string
  ventas_verificadas_ayer: number
  pedidos_ayer: number
  recolecciones_hoy: number
  discrepancias_abiertas: number
  pagos_pendientes: number
  sin_contar_en_planta: number
  leads_calientes_sin_pedido: number
}

export async function resumenDelDia(ahora = new Date()): Promise<Resumen> {
  const ayer = limitesDelDia(new Date(ahora.getTime() - DIA))
  const [reporteAyer, datos, leads] = await Promise.all([
    generar(ayer),
    tablero(ahora),
    embudoLeads(ahora),
  ])
  return {
    fecha: new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(ahora),
    ventas_verificadas_ayer: reporteAyer.total_confirmado_usd,
    pedidos_ayer: reporteAyer.total_pedidos,
    recolecciones_hoy: datos.pedidosHoy,
    discrepancias_abiertas: datos.requierenAtencion.discrepancias.length,
    pagos_pendientes: datos.requierenAtencion.esperandoPago.length,
    sin_contar_en_planta: datos.requierenAtencion.sinVerificar.length,
    leads_calientes_sin_pedido: leads.calientesSinPedido,
  }
}

async function colaDeManana(ahora: Date) {
  const { desde, hasta } = limitesDelDia(new Date(ahora.getTime() + DIA))
  const { data } = await supabaseAdmin()
    .from('pedidos')
    .select(
      'id, estado, ventana_recoleccion_inicio, vehiculo_sugerido, direccion_recoleccion, cliente:clientes(nombre_negocio, nombre_contacto, telefono)',
    )
    .gte('ventana_recoleccion_inicio', desde.toISOString())
    .lt('ventana_recoleccion_inicio', hasta.toISOString())
    .order('ventana_recoleccion_inicio', { ascending: true })
  return { recolecciones: data ?? [] }
}

/** Los 5 que más facturaron en 30 días y los 5 que pedían y dejaron de pedir. */
async function clientesTop(ahora: Date) {
  const desde = new Date(ahora.getTime() - 90 * DIA).toISOString()
  const { data } = await supabaseAdmin()
    .from('pedidos')
    .select(
      'created_at, estado, monto_confirmado_lavado, monto_estimado_lavado, cliente:clientes(id, nombre_negocio, nombre_contacto, telefono)',
    )
    .gte('created_at', desde)
    .not('estado', 'in', '("cancelado","recoleccion_fallida")')

  type Fila = {
    created_at: string
    monto_confirmado_lavado: number | null
    monto_estimado_lavado: number | null
    cliente: {
      id: string
      nombre_negocio: string | null
      nombre_contacto: string | null
      telefono: string
    } | null
  }
  const hace30 = ahora.getTime() - 30 * DIA
  const porCliente = new Map<
    string,
    { nombre: string; telefono: string; mes: number; ultimo: string }
  >()
  for (const fila of (data ?? []) as unknown as Fila[]) {
    if (!fila.cliente) continue
    const actual = porCliente.get(fila.cliente.id) ?? {
      nombre: fila.cliente.nombre_negocio || fila.cliente.nombre_contacto || fila.cliente.telefono,
      telefono: fila.cliente.telefono,
      mes: 0,
      ultimo: fila.created_at,
    }
    if (new Date(fila.created_at).getTime() >= hace30) {
      actual.mes += Number(fila.monto_confirmado_lavado ?? fila.monto_estimado_lavado ?? 0)
    }
    if (fila.created_at > actual.ultimo) actual.ultimo = fila.created_at
    porCliente.set(fila.cliente.id, actual)
  }

  const todos = [...porCliente.values()]
  return {
    top_30_dias: todos
      .filter((c) => c.mes > 0)
      .sort((a, b) => b.mes - a.mes)
      .slice(0, 5)
      .map((c) => ({ cliente: c.nombre, facturado_usd: redondear(c.mes) })),
    dejaron_de_pedir: todos
      .filter((c) => new Date(c.ultimo).getTime() < hace30)
      .sort((a, b) => b.ultimo.localeCompare(a.ultimo))
      .slice(0, 5)
      .map((c) => ({ cliente: c.nombre, telefono: c.telefono, ultimo_pedido: c.ultimo })),
  }
}

export async function consultaAdmin(
  parametros: ParametrosDe<'consulta_admin'>,
): Promise<ResultadoAccion<unknown>> {
  const permiso = await exigirNivel(parametros.telefono_operador, 'admin')
  if (!permiso.ok) return permiso.rechazo

  const ahora = new Date()
  switch (parametros.consulta) {
    case 'resumen':
      return exito(await resumenDelDia(ahora))
    case 'atencion': {
      const { requierenAtencion } = await tablero(ahora)
      const lista = (pedidos: { cliente: string; monto: number | null; id: string }[]) =>
        pedidos.map((p) => ({ cliente: p.cliente, monto: p.monto, pedido_id: p.id }))
      return exito({
        discrepancias: lista(requierenAtencion.discrepancias),
        esperando_pago: lista(requierenAtencion.esperandoPago),
        recolectados_sin_contar: lista(requierenAtencion.sinVerificar),
        nota: 'Pagos, montos y discrepancias se resuelven en el CRM.',
      })
    }
    case 'cola_manana':
      return exito(await colaDeManana(ahora))
    case 'leads_calientes': {
      const embudo = await embudoLeads(ahora)
      return exito({
        leads: embudo.sinPedido
          .filter((lead) => lead.temperatura === 'caliente')
          .map((lead) => ({
            nombre: lead.nombre,
            telefono: lead.telefono,
            necesidad: lead.necesidad,
          })),
      })
    }
    case 'clientes_top':
      return exito(await clientesTop(ahora))
    case 'como_vamos':
      // La pregunta de la dueña: cómo va el mes contra el anterior, qué deja
      // la plata y cuántos de los que escriben terminan comprando.
      return exito(await comoVamos(ahora))
  }
}

/** Margen bajo las 24 h de Meta: el envío tarda y los relojes no son exactos. */
const VENTANA_META = 23 * 60 * 60 * 1000

/**
 * Para el disparador de las 8:00: a quién mandarle el resumen, qué decirle y
 * si puede ir como texto libre (escribió en las últimas 24 h) o necesita la
 * plantilla aprobada.
 */
export async function resumenDiario(
  _parametros: ParametrosDe<'resumen_diario'>,
  ahora = new Date(),
): Promise<ResultadoAccion<unknown>> {
  const [resumen, admins] = await Promise.all([
    resumenDelDia(ahora),
    supabaseAdmin()
      .from('operador_whitelist')
      .select('nombre, telefono, ultimo_mensaje_en')
      .eq('activo', true)
      .eq('nivel', 'admin'),
  ])
  return exito({
    ...resumen,
    admins: (admins.data ?? []).map((admin) => ({
      nombre: admin.nombre,
      telefono: admin.telefono,
      dentro_de_ventana:
        admin.ultimo_mensaje_en !== null &&
        ahora.getTime() - new Date(admin.ultimo_mensaje_en).getTime() < VENTANA_META,
    })),
  })
}
