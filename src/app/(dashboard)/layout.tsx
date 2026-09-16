import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { BarraLateral } from '@/components/layout/barra-lateral'
import { verifyAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const sesion = await verifyAuth()
  if (!sesion) redirect('/login')

  return (
    <div className="min-h-screen">
      <BarraLateral
        sesion={{
          nombre: sesion.staff.nombre_completo,
          email: sesion.email,
          rol: sesion.staff.rol,
        }}
      />
      <main className="min-w-0 overflow-x-hidden px-4 pt-18 pb-10 lg:ml-64 lg:px-6 lg:pt-6">
        {children}
      </main>
    </div>
  )
}
