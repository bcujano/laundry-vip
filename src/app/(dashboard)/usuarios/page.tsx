import { redirect } from 'next/navigation'
import { FormularioNuevoUsuario, MiPassword, TablaUsuarios } from '@/components/usuarios/gestion'
import { exigirPermiso } from '@/lib/auth'
import { listar } from '@/server/staff/repo'

export const dynamic = 'force-dynamic'

export default async function Usuarios() {
  const sesion = await exigirPermiso('staff')
  if (!sesion) redirect('/')

  const personal = await listar()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Usuarios</h1>
        <p className="text-[var(--texto-suave)] text-sm">
          Aquí se dan de alta las cuentas. No existe el autoregistro.
        </p>
      </div>

      <TablaUsuarios
        usuarios={personal.map((fila) => ({
          id: fila.id,
          authUserId: fila.auth_user_id,
          email: fila.email,
          nombre: fila.nombre_completo,
          rol: fila.rol,
          activo: fila.estado === 'activo',
          esYo: fila.id === sesion.staff.id,
        }))}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <FormularioNuevoUsuario />
        <MiPassword />
      </div>
    </div>
  )
}
