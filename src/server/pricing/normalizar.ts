/**
 * Normalización de texto para emparejar lo que escribe el cliente con el
 * catálogo. "3 CAMISETAS" tiene que encontrar "Camiseta".
 */

/** Palabras que no aportan nada al emparejamiento. */
const VACIAS = new Set([
  'de',
  'del',
  'la',
  'las',
  'el',
  'los',
  'un',
  'una',
  'unos',
  'unas',
  'y',
  'o',
  'en',
  'con',
  'sin',
  'para',
  'mi',
  'mis',
  'que',
  'no',
  'es',
  'por',
  // Cantidades escritas con letra: son cuánto, no qué.
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'docena',
  'par',
  'pares',
])

/** Minúsculas, sin tildes, sin puntuación. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Singular aproximado en español. No pretende ser perfecto: solo tiene que
 * acertar en las prendas del catálogo.
 */
export function singularizar(palabra: string): string {
  if (palabra.length <= 3) return palabra
  if (palabra.endsWith('ces')) return `${palabra.slice(0, -3)}z`
  if (palabra.endsWith('es') && palabra.length > 4) return palabra.slice(0, -2)
  if (palabra.endsWith('s')) return palabra.slice(0, -1)
  return palabra
}

/**
 * Palabras significativas, ya normalizadas y en singular.
 *
 * Los números SÍ cuentan: el catálogo distingue "Edredón 2 plazas" de
 * "Edredón 3 plazas". Lo que se quita es la cantidad que el cliente antepone
 * ("3 camisetas"), porque esa es cuántas quiere, no qué prenda es.
 */
export function tokens(texto: string): string[] {
  const palabras = normalizar(texto).split(' ').filter(Boolean)

  // Solo se descarta el número si va al principio: ahí es la cantidad.
  const sinCantidad =
    palabras[0] !== undefined && /^\d+$/.test(palabras[0]) ? palabras.slice(1) : palabras

  return sinCantidad.filter((palabra) => !VACIAS.has(palabra)).map(singularizar)
}

export type Puntaje = {
  /** Cuánto de lo que dijo el cliente quedó cubierto por el nombre del ítem. */
  cobertura: number
  /** Cuánto del nombre del ítem se usó: desempata entre candidatos. */
  precision: number
}

export function puntuar(descripcion: string, nombreItem: string): Puntaje {
  const dichos = tokens(descripcion)
  const delItem = tokens(nombreItem)
  if (dichos.length === 0 || delItem.length === 0) return { cobertura: 0, precision: 0 }

  const enItem = new Set(delItem)
  const coincidencias = dichos.filter((palabra) => enItem.has(palabra)).length

  return {
    cobertura: coincidencias / dichos.length,
    precision: coincidencias / delItem.length,
  }
}

/** Por debajo de esto no se considera que el cliente haya nombrado el ítem. */
export const UMBRAL = 0.5
