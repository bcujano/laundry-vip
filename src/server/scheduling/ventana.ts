/**
 * Cálculo de la próxima ventana de recolección.
 *
 * Quito es UTC-5 fijo y sin horario de verano, así que basta con un
 * desplazamiento constante: no entra ninguna librería de fechas.
 * El agente atiende 24/7 y NUNCA rechaza por horario; si escriben un domingo
 * a las 2 de la mañana, ofrece la siguiente ventana válida.
 */
const DESPLAZAMIENTO_MS = 5 * 60 * 60 * 1000
const MS_POR_DIA = 24 * 60 * 60 * 1000

export type ParametrosVentana = {
  /** Días laborables en numeración ISO: 1 = lunes … 7 = domingo. */
  diasOperacion: number[]
  /** 'HH:MM' hora local de Quito. */
  horaInicio: string
  horaFin: string
  /** Minutos mínimos entre "ahora" y el inicio de una recolección de hoy. */
  margenMinutos: number
}

export type Ventana = { inicio: Date; fin: Date; esHoy: boolean }

/** Convierte un instante real a un Date cuyos campos UTC son la hora de Quito. */
function aLocal(instante: Date): Date {
  return new Date(instante.getTime() - DESPLAZAMIENTO_MS)
}

/** El inverso: de hora local de Quito a instante real. */
function aInstante(local: Date): Date {
  return new Date(local.getTime() + DESPLAZAMIENTO_MS)
}

function diaIso(local: Date): number {
  const dia = local.getUTCDay()
  return dia === 0 ? 7 : dia
}

function minutosDe(hora: string): number {
  const partes = /^(\d{1,2}):(\d{2})/.exec(hora)
  if (!partes) throw new Error(`Hora inválida: "${hora}". Se espera HH:MM.`)
  const horas = Number(partes[1])
  const minutos = Number(partes[2])
  if (horas > 23 || minutos > 59) throw new Error(`Hora fuera de rango: "${hora}".`)
  return horas * 60 + minutos
}

/** Medianoche local del día que contiene a `local`, más `dias` de desfase. */
function medianoche(local: Date, dias: number): Date {
  const base = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  return new Date(base + dias * MS_POR_DIA)
}

export function obtenerProximaVentana(ahora: Date, parametros: ParametrosVentana): Ventana {
  const dias = [...new Set(parametros.diasOperacion)].filter((d) => d >= 1 && d <= 7)
  if (dias.length === 0) {
    throw new Error('La configuración no tiene ningún día de operación.')
  }

  const inicioMin = minutosDe(parametros.horaInicio)
  const finMin = minutosDe(parametros.horaFin)
  if (finMin <= inicioMin) {
    throw new Error('La hora de fin de recolección debe ser posterior a la de inicio.')
  }

  const local = aLocal(ahora)
  const minimoLocal = new Date(local.getTime() + parametros.margenMinutos * 60_000)

  // Se miran 8 días: con al menos un día laborable, siempre cae uno dentro.
  for (let desfase = 0; desfase <= 7; desfase++) {
    const dia = medianoche(local, desfase)
    if (!dias.includes(diaIso(dia))) continue

    const abre = new Date(dia.getTime() + inicioMin * 60_000)
    const cierra = new Date(dia.getTime() + finMin * 60_000)

    // El inicio nunca queda antes del margen: pedir un vehículo toma tiempo.
    // Y se redondea a la media hora siguiente: al cliente se le dice «de 14:00
    // a 17:00», no «de 13:41 a 17:00», que suena a máquina.
    // Se redondea salvo que redondear se pase de la hora de cierre: entonces
    // vale el minuto exacto, que es lo que respeta el margen mínimo.
    const redondeado = redondearArriba(minimoLocal)
    // Si redondear se come la ventana entera (redondea justo al cierre o más
    // allá), vale el minuto exacto: mejor «11:47 a 12:00» que nada.
    const conMargen = redondeado < cierra ? redondeado : minimoLocal
    const inicio = minimoLocal > abre ? conMargen : abre
    if (inicio > cierra) continue

    return { inicio: aInstante(inicio), fin: aInstante(cierra), esHoy: desfase === 0 }
  }

  throw new Error('No se encontró ninguna ventana válida en los próximos 8 días.')
}

/** A la media hora siguiente, para decir horas redondas. */
function redondearArriba(local: Date): Date {
  const minutos = local.getUTCMinutes()
  const sobra = minutos % 30
  if (sobra === 0 && local.getUTCSeconds() === 0 && local.getUTCMilliseconds() === 0) return local
  const sumar = (30 - sobra) * 60_000 - local.getUTCSeconds() * 1000 - local.getUTCMilliseconds()
  return new Date(local.getTime() + sumar)
}

/** La hora más tardía a la que todavía se puede agendar para hoy. */
export function ultimaHoraDelDia(parametros: ParametrosVentana): string {
  const limite = minutosDe(parametros.horaFin) - parametros.margenMinutos
  const horas = Math.floor(limite / 60)
  const minutos = limite % 60
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

/** Inicio y fin del día natural de Quito que contiene a `instante`. */
export function limitesDelDia(instante: Date): { desde: Date; hasta: Date } {
  const local = aLocal(instante)
  const inicio = medianoche(local, 0)
  return { desde: aInstante(inicio), hasta: aInstante(new Date(inicio.getTime() + MS_POR_DIA)) }
}
