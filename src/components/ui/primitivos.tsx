import type { ComponentProps, ReactNode } from 'react'

/** Utilitario y denso: 2 o 3 personas lo usan horas al día, no es marketing. */

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[var(--radius-tarjeta)] border border-[var(--color-borde)] bg-[var(--color-superficie)] ${className}`}
    >
      {children}
    </section>
  )
}

export function TituloSeccion({ children }: { children: ReactNode }) {
  return (
    <h2 className="border-[var(--color-borde)] border-b px-4 py-2 font-semibold text-sm">
      {children}
    </h2>
  )
}

export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`border-[var(--color-borde)] border-b px-3 py-2 text-left font-medium text-[var(--color-texto-apagado)] text-xs uppercase tracking-wide ${className}`}
      scope="col"
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`border-[var(--color-borde)] border-b px-3 py-2 align-middle ${className}`}>
      {children}
    </td>
  )
}

export function Boton({ className = '', variante = 'primario', ...props }: BotonProps) {
  const estilos: Record<string, string> = {
    primario: 'bg-[var(--color-primario)] text-white',
    secundario:
      'border border-[var(--color-borde)] bg-[var(--color-superficie)] text-[var(--color-texto)]',
    destructivo: 'bg-[var(--color-destructivo)] text-white',
  }
  return (
    <button
      className={`rounded-[var(--radius-control)] px-3 py-1.5 font-medium text-sm disabled:opacity-60 ${estilos[variante]} ${className}`}
      type="button"
      {...props}
    />
  )
}

type BotonProps = ComponentProps<'button'> & {
  variante?: 'primario' | 'secundario' | 'destructivo'
}

export function Campo({ className = '', ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={`rounded-[var(--radius-control)] border border-[var(--color-borde)] bg-[var(--color-superficie)] px-2 py-1 text-sm ${className}`}
      {...props}
    />
  )
}

export function Seleccion({ className = '', ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={`rounded-[var(--radius-control)] border border-[var(--color-borde)] bg-[var(--color-superficie)] px-2 py-1 text-sm ${className}`}
      {...props}
    />
  )
}

/** Estado vacío: siempre con un mensaje que dice qué falta, nunca en blanco. */
export function Vacio({ mensaje }: { mensaje: string }) {
  return (
    <p className="px-4 py-10 text-center text-[var(--color-texto-apagado)] text-sm">{mensaje}</p>
  )
}

export function Etiqueta({ children, tono = 'neutro' }: { children: ReactNode; tono?: Tono }) {
  const tonos: Record<Tono, string> = {
    neutro: 'bg-[var(--color-fondo)] text-[var(--color-texto-apagado)]',
    exito: 'bg-[var(--color-exito)] text-white',
    alerta: 'bg-[var(--color-destructivo)] text-white',
  }
  return (
    <span className={`rounded-[var(--radius-control)] px-2 py-0.5 text-xs ${tonos[tono]}`}>
      {children}
    </span>
  )
}

type Tono = 'neutro' | 'exito' | 'alerta'
