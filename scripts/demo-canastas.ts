import type { TipoDemo } from './demo-fuente.ts'

/** Prendas típicas por tipo de negocio: nombre exacto del catálogo, método y rango de cantidad. */
export const CANASTAS: Record<TipoDemo, [string, string, number, number][]> = {
  clinica: [
    ['Mandil', 'seco', 4, 15],
    ['Camisa o blusa', 'agua', 5, 20],
    ['Duvet', 'unico', 2, 8],
    ['Almohada', 'agua', 2, 6],
  ],
  restaurante: [
    ['Mantel mediano', 'seco', 6, 20],
    ['Mantel pequeño', 'seco', 5, 15],
    ['Mandil', 'seco', 4, 12],
    ['Mantel grande', 'seco', 2, 6],
  ],
  hotel: [
    ['Edredón 2 plazas', 'agua', 4, 15],
    ['Edredón 3 plazas', 'agua', 2, 8],
    ['Duvet', 'unico', 3, 10],
    ['Almohada', 'agua', 4, 12],
    ['Cortinas pesadas', 'agua', 3, 9],
  ],
  particular: [
    ['Terno 2 piezas', 'seco', 1, 3],
    ['Camisa o blusa', 'planchado', 3, 10],
    ['Chompa', 'seco', 1, 3],
    ['Edredón 2 plazas y media', 'agua', 1, 2],
    ['Vestido largo de fiesta', 'seco', 1, 1],
    ['Zapatos deportivos', 'agua', 1, 3],
  ],
  otro: [
    ['Lavado, secado y doblado', 'agua', 10, 30],
    ['Cortinas visillos', 'agua', 2, 6],
    ['Camiseta', 'agua', 5, 20],
  ],
}
