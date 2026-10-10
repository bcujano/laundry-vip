import type { MetodoServicio } from '@/types/database'
import type { ItemPedido } from './linea'

/**
 * Las prendas como las escribe un modelo en una sola cadena, una por línea:
 *
 *     3 terno 2 piezas
 *     10 lavado secado y doblado
 *     2 camiseta | agua          ← «| método» solo si el cliente ya lo eligió
 *
 * Existe porque los modelos pequeños (Gemini flash-lite) no arman bien un parámetro JSON anidado y
 * dejaban de llamar a la herramienta; una cadena sencilla la llaman siempre. El servidor la
 * convierte en `items` (lo único que entiende el motor de precios): el modelo nunca arma cifras.
 */

const METODOS: readonly MetodoServicio[] = ['unico', 'agua', 'seco', 'planchado']

/** «3 terno», «3x terno», «3 x terno», «2,5 libras de ropa»; sin número, la cantidad es 1. */
const LINEA = /^(\d+(?:[.,]\d+)?)\s*(?:x\s+|×\s*)?(.*)$/i

export function parsearPrendas(texto: string): ItemPedido[] {
  const items: ItemPedido[] = []
  for (const cruda of texto.split(/[\n;]+/)) {
    const linea = cruda.trim()
    if (linea === '') continue
    const [prenda = '', metodoCrudo = ''] = linea.split('|').map((parte) => parte.trim())
    const partes = LINEA.exec(prenda)
    const descripcion = (partes ? (partes[2] ?? '') : prenda).trim()
    if (descripcion === '') continue
    const cantidad = partes ? Number((partes[1] ?? '1').replace(',', '.')) : 1
    const metodo = METODOS.find((m) => m === metodoCrudo.toLowerCase())
    items.push({ descripcion, cantidad, ...(metodo ? { metodo } : {}) })
  }
  return items
}
