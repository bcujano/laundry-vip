/**
 * Formato para pantalla. Quito es UTC-5 fijo y sin horario de verano, así que
 * Intl nativo basta: no entra ninguna librería de fechas.
 */
export const ZONA = 'America/Guayaquil'

const MONEDA = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

const FECHA_HORA = new Intl.DateTimeFormat('es-EC', {
  timeZone: ZONA,
  dateStyle: 'medium',
  timeStyle: 'short',
})

const FECHA = new Intl.DateTimeFormat('es-EC', { timeZone: ZONA, dateStyle: 'medium' })

const HORA = new Intl.DateTimeFormat('es-EC', {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function moneda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  const numero = typeof valor === 'string' ? Number(valor) : valor
  return Number.isFinite(numero) ? MONEDA.format(numero) : '—'
}

/** Un precio con rango se muestra como rango; nunca se elige un extremo. */
export function rangoPrecio(min: number | string, max: number | string): string {
  const desde = Number(min)
  const hasta = Number(max)
  return desde === hasta ? moneda(desde) : `${moneda(desde)} a ${moneda(hasta)}`
}

export function fechaHora(valor: string | Date | null | undefined): string {
  const fecha = aFecha(valor)
  return fecha ? FECHA_HORA.format(fecha) : '—'
}

export function soloFecha(valor: string | Date | null | undefined): string {
  const fecha = aFecha(valor)
  return fecha ? FECHA.format(fecha) : '—'
}

export function soloHora(valor: string | Date | null | undefined): string {
  const fecha = aFecha(valor)
  return fecha ? HORA.format(fecha) : '—'
}

function aFecha(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null
  const fecha = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

/** +593963987124 -> +593 96 398 7124. Solo presentación: se guarda en E.164. */
export function telefonoLegible(telefono: string | null | undefined): string {
  if (!telefono) return '—'
  const ecuador = /^\+593(\d{2})(\d{3})(\d{4})$/.exec(telefono)
  if (ecuador) return `+593 ${ecuador[1]} ${ecuador[2]} ${ecuador[3]}`
  return telefono
}

const UNIDADES: Record<string, string> = {
  pieza: 'por pieza',
  m2: 'por m²',
  kilo: 'por kilo',
  libra: 'por libra',
  paquete: 'por paquete',
  par: 'por par',
}

export function unidadLegible(unidad: string): string {
  return UNIDADES[unidad] ?? unidad
}

const METODOS: Record<string, string> = {
  unico: 'Único',
  agua: 'En agua',
  seco: 'En seco',
  planchado: 'Planchado',
}

export function metodoLegible(metodo: string): string {
  return METODOS[metodo] ?? metodo
}

const TIPOS_NEGOCIO: Record<string, string> = {
  clinica: 'Clínica',
  restaurante: 'Restaurante',
  hotel: 'Hotel',
  otro: 'Otro',
  particular: 'Particular',
}

export function tipoNegocioLegible(tipo: string): string {
  return TIPOS_NEGOCIO[tipo] ?? tipo
}
