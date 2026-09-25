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

/**
 * Palabras con las que se PREGUNTA, no prendas. Un cliente escribe «lavado de
 * zapatos» o «¿hacen tintura?»: el zapato y la tintura son lo que importa, el
 * resto es cómo se pregunta.
 *
 * No se borran —«solo lavado» y «secado» son ítems del catálogo— sino que no
 * cuentan para la cobertura. Si coinciden, suman en la precisión y desempatan.
 */
const DE_PREGUNTA = new Set([
  'lavado',
  'lavar',
  'lavan',
  'lava',
  'limpiar',
  'limpian',
  'servicio',
  'precio',
  'valor',
  'costo',
  'cuesta',
  'cuestan',
  'cobran',
  'cobra',
  'cuanto',
  'vale',
  'valen',
  'hacen',
  'hace',
  'tienen',
  'tiene',
  'ofrecen',
  'ofrece',
  'manejan',
  'aceptan',
  'reciben',
  'quiero',
  'necesito',
  'quisiera',
  'favor',
  'porfa',
  'hola',
  'buenas',
  'ustedes',
])

export type Puntaje = {
  /** Cuánto de lo que dijo el cliente quedó cubierto por el nombre del ítem. */
  cobertura: number
  /** Cuánto del nombre del ítem se usó: desempata entre candidatos. */
  precision: number
}

const VACIO: Puntaje = { cobertura: 0, precision: 0 }

function puntuarContra(dichos: string[], nombre: string): Puntaje {
  const delItem = tokens(nombre)
  if (dichos.length === 0 || delItem.length === 0) return VACIO

  const enItem = new Set(delItem)
  const coinciden = (lista: string[]) => lista.filter((palabra) => enItem.has(palabra)).length

  // La cobertura mide solo lo que nombra una prenda. Si TODO lo que dijo el
  // cliente son palabras de pregunta («solo lavado»), entonces esas mandan.
  const fuertes = dichos.filter((palabra) => !DE_PREGUNTA.has(palabra))
  const debiles = dichos.filter((palabra) => DE_PREGUNTA.has(palabra))
  const base = fuertes.length > 0 ? fuertes : debiles

  return {
    cobertura: coinciden(base) / base.length,
    // La precisión sí las cuenta: entre «Solo lavado» y «Solo secado», ante
    // «solo lavado», gana el primero.
    precision: (coinciden(fuertes) + coinciden(debiles)) / delItem.length,
  }
}

/**
 * Puntúa contra el nombre del ítem y contra cada sinónimo, y se queda con el
 * mejor: «tenis» tiene que encontrar «Zapatos deportivos».
 */
export function puntuar(
  descripcion: string,
  nombreItem: string,
  sinonimos: string[] = [],
): Puntaje {
  const dichos = tokens(descripcion)

  let mejor = VACIO
  for (const nombre of [nombreItem, ...sinonimos]) {
    const puntaje = puntuarContra(dichos, nombre)
    const gana =
      puntaje.cobertura > mejor.cobertura ||
      (puntaje.cobertura === mejor.cobertura && puntaje.precision > mejor.precision)
    if (gana) mejor = puntaje
  }
  return mejor
}

/** Por debajo de esto no se considera que el cliente haya nombrado el ítem. */
export const UMBRAL = 0.5
