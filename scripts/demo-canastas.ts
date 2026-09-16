import type { TipoDemo } from './demo-fuente.ts'

/** Prendas típicas por tipo de negocio: nombre exacto del catálogo, método y rango de cantidad. */
export const CANASTAS: Record<TipoDemo, [string, string, number, number][]> = {
  clinica: [
    ['Mandil', 'unico', 4, 15],
    ['Camisa o blusa', 'agua', 5, 20],
    ['Duvet', 'unico', 2, 8],
    ['Almohada', 'unico', 2, 6],
  ],
  restaurante: [
    ['Mantel mediano', 'unico', 6, 20],
    ['Mantel pequeño', 'unico', 5, 15],
    ['Mandil', 'unico', 4, 12],
    ['Mantel grande', 'unico', 2, 6],
  ],
  hotel: [
    ['Edredón 2 plazas', 'unico', 4, 15],
    ['Edredón 3 plazas', 'unico', 2, 8],
    ['Duvet', 'unico', 3, 10],
    ['Almohada', 'unico', 4, 12],
    ['Cortinas pesadas', 'unico', 3, 9],
  ],
  particular: [
    ['Terno 2 piezas', 'unico', 1, 3],
    ['Camisa o blusa', 'planchado', 3, 10],
    ['Chompa', 'unico', 1, 3],
    ['Edredón 2 plazas y media', 'unico', 1, 2],
    ['Vestido largo de fiesta', 'unico', 1, 1],
    ['Zapatos deportivos', 'unico', 1, 3],
  ],
  otro: [
    ['Lavado, secado y doblado', 'unico', 10, 30],
    ['Cortinas visillos', 'unico', 2, 6],
    ['Camiseta', 'agua', 5, 20],
  ],
}
