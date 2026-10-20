import { obtener as obtenerConfig } from '@/server/configuracion/repo'
import { listarProspectos } from './repo'
import { resumirProspectos } from './resumen'

/**
 * «¿Cómo va la prospección?» para la dueña. Cifras agregadas, sin teléfonos: lo que se llama o se
 * escribe se trabaja en la pantalla Prospectos del CRM.
 */
export async function estadoDeLaProspeccion() {
  const [filas, config] = await Promise.all([listarProspectos(), obtenerConfig()])
  const resumen = resumirProspectos(filas)
  return {
    envio_automatico_encendido: config.prospeccion_automatica,
    limite_diario: config.prospeccion_limite_diario,
    total: resumen.total,
    por_etapa: resumen.porEtapa,
    por_escribir: resumen.porEscribir,
    por_llamar: resumen.porLlamar,
    sin_telefono: resumen.sinTelefono,
    nota: 'El detalle de cada negocio, las llamadas y el interruptor están en el CRM, pantalla Prospectos.',
  }
}
