import type { Configuracion } from '@/types/database'

/** Cómo encontrar el local: lo que el agente le dice al cliente, sin armarlo él. */
export function datosDelLocal(
  config: Pick<Configuracion, 'direccion_local' | 'telefono_local' | 'enlace_mapa'>,
) {
  return {
    direccion: config.direccion_local,
    telefono: config.telefono_local,
    enlace_mapa: config.enlace_mapa,
  }
}
