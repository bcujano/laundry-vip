import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  diasEntre,
  type EnvioPlantilla,
  PAUSA_ENTRE_PLANTILLAS_DIAS,
} from '@/server/plantillas/candidatos'
import { limitesDelDia } from '@/server/scheduling/ventana'
import { elegirProspectos, type ProspectoElegible } from './elegir'
import {
  DOCUMENTO_PRIMER_CONTACTO,
  PLANTILLA_PRIMER_CONTACTO,
  parametrosPrimerContacto,
} from './mensaje'

/**
 * Los prospectos a los que n8n debe escribirles hoy con la plantilla de primer contacto. Va por el
 * mismo carril que la reactivación (`plantillas_pendientes` → Meta → `marcar_plantilla`): n8n no sabe
 * qué es un prospecto, solo entrega plantillas que el CRM le pide entregar.
 *
 * Quien llama decide si el interruptor está encendido; aquí solo se arma la lista.
 */
export async function prospectosPendientes(
  ahora = new Date(),
  limiteDiario = 10,
): Promise<EnvioPlantilla[]> {
  const db = supabaseAdmin()
  const [prospectos, equipo, conversaciones, clientes, enviadas] = await Promise.all([
    db
      .from('prospectos')
      .select(
        'id, nombre, segmento, telefono, tipo_telefono, cobertura, distancia_km, resenas, estado',
      )
      .eq('estado', 'nuevo')
      .eq('tipo_telefono', 'celular'),
    db.from('operador_whitelist').select('telefono'),
    db.from('conversaciones').select('telefono'),
    db.from('clientes').select('telefono'),
    db.from('plantillas_enviadas').select('telefono, plantilla, clave, enviada_en'),
  ])
  if (prospectos.error)
    throw new Error(`No se pudieron leer los prospectos: ${prospectos.error.message}`)

  // «no_seguir» vive en la conversación, y toda conversación cuenta como «ya nos escribió».
  const excluidos = new Set(
    [equipo.data, conversaciones.data, clientes.data].flatMap((filas) =>
      (filas ?? []).map((f) => f.telefono as string),
    ),
  )

  const historial = enviadas.data ?? []
  const recientes = new Set(
    historial
      .filter(
        (e) => diasEntre(new Date(e.enviada_en as string), ahora) < PAUSA_ENTRE_PLANTILLAS_DIAS,
      )
      .map((e) => e.telefono as string),
  )
  const delPrimerContacto = historial.filter((e) => e.plantilla === PLANTILLA_PRIMER_CONTACTO)
  const { desde } = limitesDelDia(ahora)

  return elegirProspectos(prospectos.data as ProspectoElegible[], {
    excluidos,
    recientes,
    yaEscritos: new Set(delPrimerContacto.map((e) => e.clave as string)),
    enviadosHoy: delPrimerContacto.filter((e) => new Date(e.enviada_en as string) >= desde).length,
    limiteDiario,
  }).map((p) => ({
    plantilla: PLANTILLA_PRIMER_CONTACTO,
    telefono: p.telefono as string,
    parametros: parametrosPrimerContacto(),
    documento: DOCUMENTO_PRIMER_CONTACTO,
    // La clave es el id del prospecto: un negocio recibe el primer contacto una sola vez en la vida.
    clave: p.id,
  }))
}
