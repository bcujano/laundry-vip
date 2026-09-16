'use client'

import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Shirt,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { salir } from '@/app/(auth)/login/actions'
import { type Area, puede } from '@/lib/permisos'
import type { RolStaff } from '@/types/database'

type Enlace = { href: string; texto: string; icono: typeof Users; area?: Area }
type Seccion = { titulo: string; enlaces: Enlace[] }

const SECCIONES: Seccion[] = [
  {
    titulo: 'Operación',
    enlaces: [
      { href: '/', texto: 'Dashboard', icono: LayoutDashboard },
      { href: '/cola', texto: 'Cola de hoy', icono: CalendarClock, area: 'pedidos' },
      { href: '/pipeline', texto: 'Pipeline', icono: KanbanSquare, area: 'pedidos' },
      { href: '/pedidos', texto: 'Pedidos', icono: ClipboardList, area: 'pedidos' },
    ],
  },
  {
    titulo: 'Clientes',
    enlaces: [{ href: '/clientes', texto: 'Clientes', icono: Users, area: 'clientes' }],
  },
  {
    titulo: 'Catálogo',
    enlaces: [{ href: '/servicios', texto: 'Servicios', icono: Shirt }],
  },
  {
    titulo: 'Análisis',
    enlaces: [
      { href: '/reportes', texto: 'Reportes', icono: BarChart3, area: 'reportes' },
      { href: '/configuracion', texto: 'Configuración', icono: Settings, area: 'configuracion' },
    ],
  },
  {
    titulo: 'Admin',
    enlaces: [{ href: '/usuarios', texto: 'Usuarios', icono: ShieldCheck, area: 'staff' }],
  },
]

const ROL_LEGIBLE: Record<RolStaff, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  operador: 'Operador',
}

export type DatosSesion = { nombre: string; email: string; rol: RolStaff }

function Contenido({ sesion, alNavegar }: { sesion: DatosSesion; alNavegar?: () => void }) {
  const ruta = usePathname()

  return (
    <>
      <div className="flex items-center justify-between border-white/10 border-b p-5">
        <div>
          <p className="font-bold text-lg text-white tracking-tight">Lavandería VIP</p>
          <p className="mt-0.5 text-white/40 text-xs">La Kennedy, Quito</p>
        </div>
        {alNavegar ? (
          <button
            aria-label="Cerrar menú"
            className="p-1 text-white/60"
            onClick={alNavegar}
            type="button"
          >
            <X size={20} />
          </button>
        ) : null}
      </div>

      <nav className="nav-lateral flex-1 overflow-y-auto p-3">
        {SECCIONES.map((seccion) => {
          const visibles = seccion.enlaces.filter(
            (enlace) => !enlace.area || puede(sesion.rol, enlace.area),
          )
          if (visibles.length === 0) return null

          return (
            <div className="mb-4" key={seccion.titulo}>
              <p className="mb-1.5 px-3 font-semibold text-[10px] text-white/30 uppercase tracking-wider">
                {seccion.titulo}
              </p>
              <div className="space-y-0.5">
                {visibles.map(({ href, texto, icono: Icono }) => {
                  const activo = href === '/' ? ruta === '/' : ruta.startsWith(href)
                  return (
                    <Link
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        activo
                          ? 'bg-white/15 font-medium text-white'
                          : 'text-white/60 hover:bg-white/5 hover:text-white'
                      }`}
                      href={href}
                      key={href}
                      onClick={alNavegar}
                    >
                      <Icono size={18} />
                      {texto}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="border-white/10 border-t p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--acento)] font-bold text-sm text-white">
            {sesion.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm text-white">{sesion.nombre}</p>
            <p className="text-white/40 text-xs">{ROL_LEGIBLE[sesion.rol]}</p>
          </div>
          <form action={salir}>
            <button
              aria-label="Cerrar sesión"
              className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              title="Cerrar sesión"
              type="submit"
            >
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

export function BarraLateral({ sesion }: { sesion: DatosSesion }) {
  const [abierta, setAbierta] = useState(false)
  const ruta = usePathname()

  // Al cambiar de pantalla en móvil, el menú se cierra solo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: la ruta es justo el disparador
  useEffect(() => {
    setAbierta(false)
  }, [ruta])

  return (
    <>
      {/* Cabecera solo de móvil */}
      <header className="fixed top-0 right-0 left-0 z-30 flex h-14 items-center gap-3 border-[var(--borde)] border-b bg-[var(--superficie)] px-4 lg:hidden">
        <button aria-label="Abrir menú" onClick={() => setAbierta(true)} type="button">
          <Menu size={22} />
        </button>
        <span className="font-semibold text-sm">Lavandería VIP</span>
      </header>

      {abierta ? (
        <button
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setAbierta(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[var(--lateral)] transition-transform lg:translate-x-0 ${
          abierta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Contenido alNavegar={abierta ? () => setAbierta(false) : undefined} sesion={sesion} />
      </aside>
    </>
  )
}
