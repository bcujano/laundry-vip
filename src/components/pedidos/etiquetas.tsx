import type { EstadoPedido } from '@/types/database'

const TEXTO: Record<EstadoPedido, string> = {
  nuevo: 'Nuevo',
  esperando_pago_para_recoleccion: 'Espera pago (recolección)',
  recolectado: 'Recolectado',
  en_proceso: 'En proceso',
  esperando_pago_para_entrega: 'Espera pago (entrega)',
  listo_para_entrega: 'Listo para entrega',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  recoleccion_fallida: 'Recolección fallida',
  discrepancia_detectada: 'Discrepancia',
}

const TONO: Record<EstadoPedido, string> = {
  nuevo: 'bg-[var(--color-primario)] text-white',
  esperando_pago_para_recoleccion: 'bg-[#F4E9C8] text-[#5A4708]',
  recolectado: 'bg-[var(--color-fondo)] text-[var(--color-texto)]',
  en_proceso: 'bg-[var(--color-fondo)] text-[var(--color-texto)]',
  esperando_pago_para_entrega: 'bg-[#F4E9C8] text-[#5A4708]',
  listo_para_entrega: 'bg-[var(--color-fondo)] text-[var(--color-texto)]',
  entregado: 'bg-[var(--color-exito)] text-white',
  cancelado: 'bg-[var(--color-fondo)] text-[var(--color-texto-apagado)]',
  recoleccion_fallida: 'bg-[var(--color-destructivo)] text-white',
  discrepancia_detectada: 'bg-[var(--color-destructivo)] text-white',
}

export function estadoLegible(estado: EstadoPedido): string {
  return TEXTO[estado] ?? estado
}

export function EtiquetaEstado({ estado }: { estado: EstadoPedido }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-[var(--radius-control)] px-2 py-0.5 text-xs ${TONO[estado]}`}
    >
      {estadoLegible(estado)}
    </span>
  )
}

export function canalLegible(canal: string): string {
  return canal === 'presencial' ? 'Presencial' : 'Agente WhatsApp'
}
