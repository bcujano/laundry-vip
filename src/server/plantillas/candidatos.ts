import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * A quién se le escribe hoy con una plantilla de Meta, y con cuál:
 *  - reactivación: clientes con 2+ pedidos entregados que llevan 30 o 90 días sin pedir;
 *  - ropa no retirada: pedidos «listos para entrega» que siguen sin retirarse a los 7, 30, 60 y 80 días.
 * Nunca a quien pidió que no le escriban, a quien tiene un pedido abierto, a una persona del equipo,
 * ni a quien ya recibió una plantilla en los últimos 25 días. Un paso atrasado sale una sola vez
 * (solo el más alto que le corresponde).
 */
export type EnvioPlantilla = {
  plantilla: string
  telefono: string
  parametros: string[]
  clave: string
}

const DIA_MS = 86_400_000
const PAUSA_ENTRE_PLANTILLAS_DIAS = 25
export const PASOS_REACTIVACION = [90, 30] as const
export const PASOS_ROPA = [80, 60, 30, 7] as const

export const diasEntre = (desde: Date, hasta: Date) =>
  Math.floor((hasta.getTime() - desde.getTime()) / DIA_MS)

/** El paso más alto que ya corresponde y que todavía no se envió. */
export function pasoPendiente(
  dias: number,
  pasos: readonly number[],
  enviados: ReadonlySet<number>,
): number | null {
  const paso = pasos.find((p) => dias >= p)
  return paso !== undefined && !enviados.has(paso) ? paso : null
}

const primerNombre = (nombre: string | null) => (nombre ?? '').trim().split(/\s+/)[0] || 'cliente'

export async function plantillasPendientes(
  ahora = new Date(),
  limite = 20,
): Promise<EnvioPlantilla[]> {
  const db = supabaseAdmin()
  const [
    { data: clientes },
    { data: pedidos },
    { data: enviadas },
    { data: equipo },
    { data: conv },
  ] = await Promise.all([
    db.from('clientes').select('id, telefono, nombre_contacto'),
    db.from('pedidos').select('id, cliente_id, estado, created_at'),
    db.from('plantillas_enviadas').select('telefono, plantilla, clave, enviada_en'),
    db.from('operador_whitelist').select('telefono'),
    db.from('conversaciones').select('telefono').eq('no_seguir', true),
  ])

  const excluidos = new Set([
    ...(equipo ?? []).map((e) => e.telefono as string),
    ...(conv ?? []).map((c) => c.telefono as string),
  ])
  const recientes = new Set(
    (enviadas ?? [])
      .filter(
        (e) => diasEntre(new Date(e.enviada_en as string), ahora) < PAUSA_ENTRE_PLANTILLAS_DIAS,
      )
      .map((e) => e.telefono as string),
  )
  const claves = new Set((enviadas ?? []).map((e) => `${e.plantilla}|${e.clave}`))
  const porCliente = new Map((clientes ?? []).map((c) => [c.id as string, c]))
  const envios: EnvioPlantilla[] = []

  // ── Reactivación ──────────────────────────────────────────────────────
  const entregados = new Map<string, Date[]>()
  const abiertos = new Set<string>()
  for (const p of pedidos ?? []) {
    const id = p.cliente_id as string
    if (p.estado === 'entregado') {
      entregados.set(id, [...(entregados.get(id) ?? []), new Date(p.created_at as string)])
    } else if (p.estado !== 'cancelado') abiertos.add(id)
  }
  for (const [id, fechas] of entregados) {
    const c = porCliente.get(id)
    if (!c || fechas.length < 2 || abiertos.has(id)) continue
    const tel = c.telefono as string
    if (excluidos.has(tel) || recientes.has(tel)) continue
    const dias = diasEntre(new Date(Math.max(...fechas.map((f) => f.getTime()))), ahora)
    const hechos = new Set(
      PASOS_REACTIVACION.filter((s) => claves.has(`reactivacion_${s}_dias|${s}`)),
    )
    const paso = pasoPendiente(dias, PASOS_REACTIVACION, hechos)
    if (paso === null) continue
    envios.push({
      plantilla: `reactivacion_${paso}_dias`,
      telefono: tel,
      parametros: [primerNombre(c.nombre_contacto as string | null)],
      clave: String(paso),
    })
  }

  // ── Ropa que no se retira ─────────────────────────────────────────────
  const listos = (pedidos ?? []).filter((p) => p.estado === 'listo_para_entrega')
  if (listos.length > 0) {
    const { data: eventos } = await db
      .from('pedido_eventos')
      .select('pedido_id, created_at')
      .eq('estado_nuevo', 'listo_para_entrega')
      .in(
        'pedido_id',
        listos.map((p) => p.id as string),
      )
    const desde = new Map<string, Date>()
    for (const e of eventos ?? []) {
      const fecha = new Date(e.created_at as string)
      const previa = desde.get(e.pedido_id as string)
      if (!previa || fecha > previa) desde.set(e.pedido_id as string, fecha)
    }
    for (const p of listos) {
      const c = porCliente.get(p.cliente_id as string)
      const inicio = desde.get(p.id as string)
      if (!c || !inicio) continue
      const tel = c.telefono as string
      if (excluidos.has(tel) || recientes.has(tel)) continue
      const dias = diasEntre(inicio, ahora)
      const hechos = new Set(
        PASOS_ROPA.filter((s) => claves.has(`ropa_no_retirada|pedido:${p.id}:${s}`)),
      )
      const paso = pasoPendiente(dias, PASOS_ROPA, hechos)
      if (paso === null) continue
      envios.push({
        plantilla: 'ropa_no_retirada',
        telefono: tel,
        parametros: [primerNombre(c.nombre_contacto as string | null), String(dias)],
        clave: `pedido:${p.id}:${paso}`,
      })
    }
  }

  // Un solo envío por teléfono y por corrida.
  const vistos = new Set<string>()
  return envios.filter((e) => !vistos.has(e.telefono) && vistos.add(e.telefono)).slice(0, limite)
}

export async function marcarPlantillaEnviada(telefono: string, plantilla: string, clave: string) {
  const { error } = await supabaseAdmin()
    .from('plantillas_enviadas')
    .upsert(
      { telefono, plantilla, clave },
      { onConflict: 'plantilla,clave', ignoreDuplicates: true },
    )
  if (error) throw new Error(`No se pudo registrar la plantilla enviada: ${error.message}`)
}
