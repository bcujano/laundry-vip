import Link from 'next/link'
import { type Area, puede } from '@/lib/auth'
import type { RolStaff } from '@/types/database'

/**
 * Sin `area` el enlace lo ve cualquier rol. El catálogo entra ahí a propósito:
 * el operador necesita consultar precios para trabajar, aunque no pueda
 * tocarlos. Ver no es editar.
 */
const ENLACES: { href: string; texto: string; area?: Area }[] = [
  { href: '/', texto: 'Cola de hoy', area: 'pedidos' },
  { href: '/pedidos', texto: 'Pedidos', area: 'pedidos' },
  { href: '/clientes', texto: 'Clientes', area: 'clientes' },
  { href: '/servicios', texto: 'Servicios' },
  { href: '/reportes', texto: 'Reportes', area: 'reportes' },
  { href: '/configuracion', texto: 'Configuración', area: 'configuracion' },
]

/**
 * Ocultar un enlace es comodidad, no seguridad: cada pantalla vuelve a exigir
 * el permiso en el servidor.
 */
export function Navegacion({ rol, email }: { rol: RolStaff; email: string }) {
  return (
    <header className="border-[var(--color-borde)] border-b bg-[var(--color-superficie)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <span className="font-semibold text-sm">Lavandería VIP</span>
        <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {ENLACES.filter((enlace) => !enlace.area || puede(rol, enlace.area)).map((enlace) => (
            <Link
              className="rounded-[var(--radius-control)] px-1 py-0.5 hover:underline"
              href={enlace.href}
              key={enlace.href}
            >
              {enlace.texto}
            </Link>
          ))}
        </nav>
        <span className="ml-auto text-[var(--color-texto-apagado)] text-xs">
          {email} · {rol}
        </span>
      </div>
    </header>
  )
}
