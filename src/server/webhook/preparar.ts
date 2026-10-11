import { parsearPrendas } from '../pricing/prendas-texto'

/**
 * Acepta las prendas como texto (`prendas: "3 terno 2 piezas
10 lavado secado y doblado"`) además de
 * `items`, y trata las cadenas vacías como ausentes: un modelo pequeño llama sin problema a una
 * herramienta con cadenas, no con JSON anidado (ver pricing/prendas-texto.ts).
 */
export function prepararPrendas(bruto: unknown): unknown {
  if (!bruto || typeof bruto !== 'object') return bruto
  const o: Record<string, unknown> = { ...(bruto as Record<string, unknown>) }
  for (const [clave, valor] of Object.entries(o)) {
    if (typeof valor === 'string' && valor.trim() === '') delete o[clave]
  }
  if (typeof o.prendas === 'string') {
    if (!Array.isArray(o.items)) o.items = parsearPrendas(o.prendas)
    delete o.prendas
  }
  return o
}

/**
 * Lo que se contó en planta, escrito como lo dicta el operador, una línea por prenda:
 *   6 camisa
 *   2 pantalón
 * Un modelo pequeño no arma bien un arreglo de objetos; una cadena sí.
 */
export function prepararConteo(bruto: unknown): unknown {
  const o = prepararPrendas(bruto) as Record<string, unknown>
  if (!o || typeof o !== 'object') return o
  if (typeof o.conteos === 'string') {
    o.conteos = parsearPrendas(o.conteos).map((p) => ({
      descripcion: p.descripcion,
      cantidad: p.cantidad,
    }))
  }
  return o
}

/** Quien trae y retira su ropa no necesita transporte nuestro: se completa solo. */
export function prepararPedido(bruto: unknown): unknown {
  const o = prepararPrendas(bruto) as Record<string, unknown>
  if (!o || typeof o !== 'object') return o
  o.canal ??= 'whatsapp_agente'
  if (o.tipo_entrega === 'a_la_carta') {
    o.metodo_transporte_recoleccion ??= 'propio_cliente'
    o.metodo_transporte_entrega ??= 'propio_cliente'
  }
  return o
}
