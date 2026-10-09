/**
 * Horas hábiles del local y la frase que se le promete al cliente.
 *
 * Todo sale de Configuración (días y horas de atención): otra lavandería con otro horario
 * solo cambia sus datos. Quito es UTC-5 fijo, sin librería de fechas.
 * Puras y sin base, para probarlas con relojes inventados.
 */

const DESPLAZAMIENTO_MS = 5 * 60 * 60 * 1000
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export type HorarioLocal = {
  /** 1 = lunes … 7 = domingo. */
  dias: number[]
  apertura: string
  cierre: string
  cierreSabado: string
}

const minutosDe = (hora: string) => {
  const [h, m] = hora.split(':')
  return Number(h) * 60 + Number(m)
}

type Local = { dia: number; minutos: number; mediaNoche: number }

function aLocal(instante: Date): Local {
  const local = new Date(instante.getTime() - DESPLAZAMIENTO_MS)
  const dia = local.getUTCDay() === 0 ? 7 : local.getUTCDay()
  return {
    dia,
    minutos: local.getUTCHours() * 60 + local.getUTCMinutes(),
    mediaNoche: Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
  }
}

const cierreDe = (dia: number, h: HorarioLocal) => minutosDe(dia === 6 ? h.cierreSabado : h.cierre)

/** ¿El local atiende en este instante? */
export function estaAbierto(instante: Date, h: HorarioLocal): boolean {
  const { dia, minutos } = aLocal(instante)
  return h.dias.includes(dia) && minutos >= minutosDe(h.apertura) && minutos < cierreDe(dia, h)
}

/** Minutos de atención del local entre dos instantes (para «30 minutos hábiles»). */
export function minutosHabiles(desde: Date, hasta: Date, h: HorarioLocal): number {
  if (hasta <= desde) return 0
  let total = 0
  // Se recorre minuto a minuto por tramos de un día: son pocas iteraciones por llamada.
  let cursor = desde.getTime()
  while (cursor < hasta.getTime()) {
    const { dia, minutos } = aLocal(new Date(cursor))
    const abre = minutosDe(h.apertura)
    const cierra = cierreDe(dia, h)
    const restoDelDia = 24 * 60 - minutos
    const tramo = Math.min(restoDelDia, Math.ceil((hasta.getTime() - cursor) / 60_000))
    if (h.dias.includes(dia)) {
      const ini = Math.max(minutos, abre)
      const fin = Math.min(minutos + tramo, cierra)
      if (fin > ini) total += fin - ini
    }
    cursor += tramo * 60_000
  }
  return total
}

/**
 * Cuándo responde una persona, dicho como se le dice al cliente. Nunca «pronto»:
 *  - con el local abierto: «en unos 30 minutos»;
 *  - antes de abrir el mismo día: «hoy a partir de las 9:00»;
 *  - fuera de horario: «mañana a partir de las 9:00», o «el lunes a partir de las 9:00»
 *    si el local no abre mañana o hoy es día de descanso (sábado tarde, domingo).
 */
export function frasePlazoHumano(ahora: Date, h: HorarioLocal): string {
  if (estaAbierto(ahora, h)) return 'en unos 30 minutos'
  const { dia, minutos, mediaNoche } = aLocal(ahora)
  const hora = `${Number(h.apertura.split(':')[0])}:${h.apertura.split(':')[1]}`
  if (h.dias.includes(dia) && minutos < minutosDe(h.apertura)) return `hoy a partir de las ${hora}`
  for (let desfase = 1; desfase <= 7; desfase++) {
    const siguiente = new Date(mediaNoche + desfase * 86_400_000)
    const d = siguiente.getUTCDay() === 0 ? 7 : siguiente.getUTCDay()
    if (!h.dias.includes(d)) continue
    // «Mañana» solo si hoy se trabaja y mañana también; un domingo se dice «el lunes».
    return desfase === 1 && h.dias.includes(dia)
      ? `mañana a partir de las ${hora}`
      : `el ${DIAS[siguiente.getUTCDay()]} a partir de las ${hora}`
  }
  return `en cuanto abramos, a partir de las ${hora}`
}
