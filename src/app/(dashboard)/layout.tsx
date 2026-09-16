import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { Navegacion } from '@/components/layout/navegacion'
import { verifyAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const sesion = await verifyAuth()
  if (!sesion) redirect('/login')

  return (
    <div className="min-h-screen">
      <Navegacion email={sesion.email} rol={sesion.staff.rol} />
      <div className="p-4">{children}</div>
    </div>
  )
}
