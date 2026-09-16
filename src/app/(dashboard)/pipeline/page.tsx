import { Pipeline } from '@/components/pedidos/pipeline'
import { Tarjeta, Vacio } from '@/components/ui/primitivos'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { EstadoPedido } from '@/types/database'

export const dynamic = 'force-dynamic'

type Fila = {
  id: string
  estado: EstadoPedido
  monto_confirmado_lavado: number | null
  monto_estimado_lavado: number | null
  ventana_recoleccion_inicio: string | null
  discrepancia_detectada: boolean
  cliente: {
    nombre_negocio: string | null
    nombre_contacto: string | null
    telefono: string
  } | null
}

export default async function PaginaPipeline() {
  // Se muestran los últimos 60 días: un tablero con todo el histórico no se lee.
  const desde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabaseAdmin()
    .from('pedidos')
    .select(
      'id, estado, monto_confirmado_lavado, monto_estimado_lavado, ventana_recoleccion_inicio, discrepancia_detectada, cliente:clientes(nombre_negocio, nombre_contacto, telefono)',
    )
    .gte('created_at', desde)
    .order('ventana_recoleccion_inicio', { ascending: true })

  const filas = (data ?? []) as unknown as Fila[]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Pipeline</h1>
        <p className="text-[var(--texto-suave)] text-sm">
          {filas.length} pedidos de los últimos 60 días
        </p>
      </div>

      {filas.length === 0 ? (
        <Tarjeta>
          <Vacio mensaje="Todavía no hay pedidos que mostrar en el tablero." />
        </Tarjeta>
      ) : (
        <Pipeline
          pedidos={filas.map((fila) => ({
            id: fila.id,
            estado: fila.estado,
            cliente:
              fila.cliente?.nombre_negocio ||
              fila.cliente?.nombre_contacto ||
              fila.cliente?.telefono ||
              'Cliente eliminado',
            monto: fila.monto_confirmado_lavado ?? fila.monto_estimado_lavado,
            ventana: fila.ventana_recoleccion_inicio,
            discrepancia: fila.discrepancia_detectada,
          }))}
        />
      )}
    </div>
  )
}
