import type { Servicio } from '@/types/database'

/**
 * El catálogo agrupado para la imagen que se manda por WhatsApp. Todo sale de la
 * tabla `servicios` (el CRM manda): si el dueño cambia un precio, la próxima
 * imagen ya lo trae. Nada de esto va escrito en el prompt.
 */

export type FilaCatalogo = { nombre: string; detalle: string }
export type CategoriaCatalogo = { titulo: string; filas: FilaCatalogo[] }

type Fila = Pick<
  Servicio,
  | 'categoria'
  | 'nombre_item'
  | 'metodo'
  | 'unidad'
  | 'precio_min'
  | 'precio_max'
  | 'cantidad_por_paquete'
  | 'precio_paquete'
>

/** Lo principal primero; el resto va en orden alfabético. */
const PRIORIDAD = ['Lavado en agua', 'Camisas y blusas', 'Prendas de vestir', 'Trajes y abrigos']
const ORDEN_METODO = ['agua', 'seco', 'planchado', 'unico']
const ETIQUETA_METODO: Record<string, string> = {
  agua: 'en agua',
  seco: 'en seco',
  planchado: 'planchado',
  unico: '',
}
const SUFIJO_UNIDAD: Record<string, string> = {
  pieza: '',
  libra: ' por libra',
  kilo: ' por kilo',
  par: ' por par',
  m2: ' por m²',
  paquete: ' por paquete',
}

export const dinero = (n: number) => `$${Number(n).toFixed(2).replace('.', ',')}`

function precio(f: Fila): string {
  const min = Number(f.precio_min)
  const max = Number(f.precio_max)
  const base = max > min ? `${dinero(min)} a ${dinero(max)}` : dinero(min)
  if (f.precio_paquete !== null && f.cantidad_por_paquete) {
    return `${base} c/u · ${f.cantidad_por_paquete} por ${dinero(Number(f.precio_paquete))}`
  }
  return base
}

export function agruparCatalogo(servicios: Fila[]): CategoriaCatalogo[] {
  const porCategoria = new Map<string, Map<string, Fila[]>>()
  for (const s of servicios) {
    const items = porCategoria.get(s.categoria) ?? new Map<string, Fila[]>()
    items.set(s.nombre_item, [...(items.get(s.nombre_item) ?? []), s])
    porCategoria.set(s.categoria, items)
  }

  const titulos = [...porCategoria.keys()].sort((a, b) => {
    const pa = PRIORIDAD.indexOf(a)
    const pb = PRIORIDAD.indexOf(b)
    if (pa >= 0 || pb >= 0) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb)
    return a.localeCompare(b, 'es')
  })

  return titulos.map((titulo) => {
    const items = porCategoria.get(titulo) ?? new Map<string, Fila[]>()
    const filas = [...items.entries()].map(([nombre, variantes]) => {
      const ordenadas = [...variantes].sort(
        (a, b) => ORDEN_METODO.indexOf(a.metodo) - ORDEN_METODO.indexOf(b.metodo),
      )
      const sufijo = SUFIJO_UNIDAD[ordenadas[0]?.unidad ?? 'pieza'] ?? ''
      const detalle =
        ordenadas.length === 1
          ? `${precio(ordenadas[0] as Fila)}${sufijo}`
          : `${ordenadas
              .map((v) => `${ETIQUETA_METODO[v.metodo] ?? v.metodo} ${precio(v)}`)
              .join(' · ')}${sufijo}`
      return { nombre, detalle }
    })
    return { titulo, filas }
  })
}

export const ALTO_TITULO = 70
export const SEPARACION = 26
/** Caracteres por renglón del detalle en una columna de la imagen (aprox.). */
const CARACTERES_POR_RENGLON = 32

/** ¿Caben nombre y precio en un solo renglón de la columna? (25 px y 23 px, a ojo) */
export const cabeEnUnaLinea = (f: FilaCatalogo) =>
  f.nombre.length * 14 + f.detalle.length * 12 <= 400

/** Alto de una fila: una línea si cabe; si no, el nombre y el detalle en los renglones que haga falta. */
export const altoFila = (f: FilaCatalogo) =>
  cabeEnUnaLinea(f)
    ? 46
    : 40 + 30 * Math.max(1, Math.ceil(f.detalle.length / CARACTERES_POR_RENGLON))

const altoCategoria = (c: CategoriaCatalogo) =>
  ALTO_TITULO + c.filas.reduce((s, f) => s + altoFila(f), 0) + SEPARACION

/** Reparte las categorías en columnas de alto parecido, sin partir ninguna. */
export function repartirEnColumnas(
  categorias: CategoriaCatalogo[],
  columnas = 2,
): { columnas: CategoriaCatalogo[][]; alto: number } {
  const total = categorias.reduce((s, c) => s + altoCategoria(c), 0)
  const objetivo = total / columnas
  const salida: CategoriaCatalogo[][] = Array.from({ length: columnas }, () => [])
  const altos = Array.from({ length: columnas }, () => 0)
  let actual = 0
  for (const c of categorias) {
    if (actual < columnas - 1 && (altos[actual] ?? 0) + altoCategoria(c) / 2 > objetivo) actual += 1
    salida[actual]?.push(c)
    altos[actual] = (altos[actual] ?? 0) + altoCategoria(c)
  }
  return { columnas: salida, alto: Math.max(...altos) }
}
