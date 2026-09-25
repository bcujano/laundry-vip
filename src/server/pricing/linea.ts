import type { MetodoServicio, Servicio } from '@/types/database'
import { puntuar, UMBRAL } from './normalizar'

/**
 * Una línea de la cotización: emparejar lo que dijo el cliente con el catálogo
 * y calcular su subtotal. `cotizar.ts` arma la cotización completa con esto.
 */

export type ItemPedido = { descripcion: string; cantidad: number; metodo?: MetodoServicio }

export type LineaCotizada = {
  descripcion: string
  cantidad: number
  encontrado: boolean
  servicio_id?: string
  nombre_item?: string
  metodo?: MetodoServicio
  unidad?: string
  precio_unitario?: number
  subtotal?: number
  /** El ítem admite varios métodos y el cliente no dijo cuál. */
  requiere_metodo?: boolean
  metodos_disponibles?: MetodoServicio[]
  /** La prenda se lava de una sola forma: no hay nada que preguntar ni ofrecer. */
  metodo_unico?: boolean
  /** El cliente pidió un método que esa prenda no admite; se cotizó con el suyo. */
  advertencia?: string
  /** Nada encajó, pero esto se le parece: se pregunta, no se niega. */
  sugerencias?: string[]
  /** Varios ítems del catálogo encajan con lo que dijo: hay que preguntar. */
  requiere_desambiguacion?: boolean
  opciones?: { nombre_item: string; precio_min: number; precio_max: number; unidad: string }[]
  /** Los dos peluches tienen rango; no se elige un extremo. */
  es_rango?: boolean
  precio_min?: number
  precio_max?: number
  /** Ítems que se cobran por paquete cerrado o con promoción por cantidad. */
  paquetes_cobrados?: number
  nota?: string
}

export type Grupo = { nombre_item: string; sinonimos: string[]; filas: Servicio[] }

export const NOTA_SIN_PRECIO = 'a confirmar por el operador'

export function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

export function agrupar(catalogo: Servicio[]): Grupo[] {
  const porNombre = new Map<string, Servicio[]>()
  for (const fila of catalogo) {
    const filas = porNombre.get(fila.nombre_item) ?? []
    filas.push(fila)
    porNombre.set(fila.nombre_item, filas)
  }
  return [...porNombre.entries()].map(([nombre_item, filas]) => ({
    nombre_item,
    // Los sinónimos de todas las variantes del ítem, sin repetir.
    sinonimos: [...new Set(filas.flatMap((fila) => fila.sinonimos ?? []))],
    filas,
  }))
}

/**
 * Empareja la descripción con el catálogo.
 * `ganador` solo viene si uno destaca sin empate; si empatan, `finalistas`
 * trae todas las opciones plausibles para preguntarle al cliente.
 */
export function emparejar(
  descripcion: string,
  grupos: Grupo[],
): { ganador?: Grupo; finalistas: Grupo[] } {
  const puntuados = grupos
    .map((grupo) => ({ grupo, puntaje: puntuar(descripcion, grupo.nombre_item, grupo.sinonimos) }))
    .filter((candidato) => candidato.puntaje.cobertura >= UMBRAL)

  if (puntuados.length === 0) return { finalistas: [] }

  const maxCobertura = Math.max(...puntuados.map((c) => c.puntaje.cobertura))
  const finalistas = puntuados.filter((c) => c.puntaje.cobertura === maxCobertura)

  // Con la misma cobertura, gana quien use más de su propio nombre: entre
  // "Chal" y "Chaleco" ante "chal", el primero es exacto.
  const maxPrecision = Math.max(...finalistas.map((c) => c.puntaje.precision))
  const ganadores = finalistas.filter((c) => c.puntaje.precision === maxPrecision)

  return {
    ganador: ganadores.length === 1 ? ganadores[0]?.grupo : undefined,
    finalistas: finalistas.map((c) => c.grupo),
  }
}

/**
 * Cuando nada supera el umbral, lo que más se acercó. Sirve para preguntar
 * («¿se refiere a…?») en vez de decirle al cliente que no se ofrece algo que
 * sí está en el catálogo, que es como se pierden clientes.
 */
export function parecidos(descripcion: string, grupos: Grupo[], cuantos = 3): string[] {
  return grupos
    .map((grupo) => ({ grupo, puntaje: puntuar(descripcion, grupo.nombre_item, grupo.sinonimos) }))
    .filter((c) => c.puntaje.cobertura > 0)
    .sort(
      (a, b) =>
        b.puntaje.cobertura - a.puntaje.cobertura || b.puntaje.precision - a.puntaje.precision,
    )
    .slice(0, cuantos)
    .map((c) => c.grupo.nombre_item)
}

export function cotizarGrupo(item: ItemPedido, grupo: Grupo): LineaCotizada {
  const base = { descripcion: item.descripcion, cantidad: item.cantidad, encontrado: true }
  const metodosDisponibles = grupo.filas.map((fila) => fila.metodo)
  const exigeMetodo = grupo.filas.some((fila) => fila.requiere_seleccion_metodo)

  // Nunca se asume un método cuando la prenda admite varios: se pregunta.
  if (exigeMetodo && !item.metodo) {
    return {
      ...base,
      nombre_item: grupo.nombre_item,
      requiere_metodo: true,
      metodos_disponibles: metodosDisponibles,
      nota: `"${grupo.nombre_item}" se puede lavar de varias formas. Hay que preguntar cuál.`,
    }
  }

  const pedida = item.metodo ? grupo.filas.find((f) => f.metodo === item.metodo) : undefined
  // Un terno no se lava en agua. Si la prenda tiene un solo método y el cliente
  // pidió otro, se cotiza con el que de verdad se usa y se le avisa: quedarse
  // sin precio por eso solo lograba que el agente no cotizara nada.
  const unica = grupo.filas.length === 1 ? (grupo.filas[0] as Servicio) : undefined
  const fila = pedida ?? (item.metodo ? unica : (grupo.filas[0] as Servicio | undefined))

  if (!fila) {
    return {
      ...base,
      encontrado: false,
      nombre_item: grupo.nombre_item,
      requiere_metodo: true,
      metodos_disponibles: metodosDisponibles,
      nota: `"${grupo.nombre_item}" no se ofrece con ese método.`,
    }
  }

  const precioMin = Number(fila.precio_min)
  const precioMax = Number(fila.precio_max)

  const comun = {
    ...base,
    servicio_id: fila.id,
    nombre_item: fila.nombre_item,
    metodo: fila.metodo,
    // Sin otras filas con el mismo nombre, este método es el único posible:
    // el agente no debe ofrecer alternativas que no existen.
    metodo_unico: grupo.filas.length === 1,
    unidad: fila.unidad,
    ...(!pedida && item.metodo && fila.metodo !== 'unico'
      ? { advertencia: `"${fila.nombre_item}" solo se lava en ${fila.metodo}: se cotiza así.` }
      : {}),
  }

  // Rango: se informan los dos límites y no se calcula subtotal.
  if (precioMin !== precioMax) {
    return {
      ...comun,
      es_rango: true,
      precio_min: precioMin,
      precio_max: precioMax,
      nota: 'El precio final depende del tamaño; lo confirma el operador.',
    }
  }

  const porPaquete = fila.cantidad_por_paquete ?? 0
  const precioPaquete = fila.precio_paquete === null ? null : Number(fila.precio_paquete)

  // Promoción por cantidad: 4 cobijas son un paquete de 3 a $12,00 más una
  // suelta a $5,00. El sobrante nunca se redondea hacia arriba a otro paquete.
  if (precioPaquete !== null && porPaquete > 1) {
    const paquetes = Math.floor(item.cantidad / porPaquete)
    const sueltas = item.cantidad % porPaquete
    return {
      ...comun,
      precio_unitario: precioMin,
      paquetes_cobrados: paquetes,
      subtotal: redondear(paquetes * precioPaquete + sueltas * precioMin),
      nota:
        paquetes > 0
          ? `${paquetes} paquete(s) de ${porPaquete} a ${precioPaquete.toFixed(2)}` +
            (sueltas > 0 ? ` y ${sueltas} suelta(s) a ${precioMin.toFixed(2)}.` : '.')
          : `Sueltas a ${precioMin.toFixed(2)}; ${porPaquete} salen en ${precioPaquete.toFixed(2)}.`,
    }
  }

  // Se cobra por paquete cerrado: 5 prendas en paquetes de 3 son 2 paquetes.
  if (fila.unidad === 'paquete' && porPaquete > 1) {
    const paquetes = Math.ceil(item.cantidad / porPaquete)
    return {
      ...comun,
      precio_unitario: precioMin,
      paquetes_cobrados: paquetes,
      subtotal: redondear(paquetes * precioMin),
      nota: `Se cobra por paquete de ${porPaquete}: ${paquetes} paquete(s).`,
    }
  }

  return {
    ...comun,
    precio_unitario: precioMin,
    subtotal: redondear(item.cantidad * precioMin),
  }
}
