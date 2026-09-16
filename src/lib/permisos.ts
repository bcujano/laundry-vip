import type { RolStaff } from '@/types/database'

/**
 * Matriz de permisos. Vive aparte de auth.ts a propósito: la barra lateral es
 * un componente de cliente y necesita saber qué enlaces mostrar, pero auth.ts
 * arrastra next/headers, que solo existe en el servidor.
 *
 * Ojo: esto decide qué se VE. Lo que se PUEDE hacer lo decide el servidor,
 * siempre, en cada acción.
 */
export type Area =
  | 'pedidos'
  | 'clientes'
  | 'reportes'
  | 'servicios'
  | 'borrar'
  | 'configuracion'
  | 'staff'

/**
 * "borrar" es su propia área a propósito: un operador puede trabajar un pedido
 * entero pero no hacerlo desaparecer.
 */
const PERMISOS: Record<RolStaff, ReadonlySet<Area>> = {
  superadmin: new Set([
    'pedidos',
    'clientes',
    'reportes',
    'servicios',
    'borrar',
    'configuracion',
    'staff',
  ]),
  admin: new Set(['pedidos', 'clientes', 'reportes', 'servicios', 'borrar']),
  operador: new Set(['pedidos', 'clientes']),
}

export function puede(rol: RolStaff, area: Area): boolean {
  return PERMISOS[rol].has(area)
}
