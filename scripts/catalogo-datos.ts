/**
 * Catálogo real de la planta: 54 filas, transcritas de la lista física de
 * precios. No se redondea, no se completa y no se "limpia".
 * precio_min y precio_max son iguales salvo en los dos peluches con rango.
 */
export type FilaCatalogo = {
  categoria: string
  nombre_item: string
  metodo: 'unico' | 'agua' | 'seco' | 'planchado'
  unidad: 'pieza' | 'm2' | 'kilo' | 'libra' | 'paquete' | 'par'
  precio_min: number
  precio_max: number
  cantidad_por_paquete: number | null
  requiere_seleccion_metodo: boolean
}

function fila(
  categoria: string,
  nombre_item: string,
  precio: number,
  unidad: FilaCatalogo['unidad'] = 'pieza',
): FilaCatalogo {
  return {
    categoria,
    nombre_item,
    metodo: 'unico',
    unidad,
    precio_min: precio,
    precio_max: precio,
    cantidad_por_paquete: null,
    requiere_seleccion_metodo: false,
  }
}

const ALFOMBRAS: FilaCatalogo[] = [
  fila('Alfombras', 'Alfombra de pelo corto', 7.0, 'm2'),
  fila('Alfombras', 'Alfombra de pelo alto', 8.0, 'm2'),
]

const LAVADO_EN_SECO: FilaCatalogo[] = [
  ['Terno 3 piezas', 8.5],
  ['Terno 2 piezas', 7.5],
  ['Saco de terno', 3.75],
  ['Pantalón de terno', 3.75],
  ['Abrigo liviano o gabardina', 5.5],
  ['Abrigo pesado', 7.5],
  ['Chal', 3.0],
  ['Chaleco', 3.5],
  ['Chompa', 5.5],
  ['Chompa de cuero', 8.0],
  ['Falda corta', 3.5],
  ['Falda larga', 4.5],
  ['Mandil', 4.0],
  ['Mantel pequeño', 3.5],
  ['Mantel mediano', 4.0],
  ['Mantel grande', 5.0],
  ['Vestido corto', 5.0],
  ['Vestido largo de fiesta', 7.0],
  ['Vestido de primera comunión', 6.0],
  ['Vestido de novia sencillo', 20.5],
  ['Vestido de novia con cola', 25.5],
  ['Enterizo', 5.0],
  ['Edredón de plumas o en seco', 8.0],
  ['Tinturado', 6.0],
].map(([nombre, precio]) => fila('Lavado en seco', nombre as string, precio as number))

// Los dos únicos ítems donde el agente DEBE preguntar el método antes de cotizar.
const MULTIPLE_METODO: FilaCatalogo[] = (
  [
    ['Camisa o blusa', 'agua', 2.25],
    ['Camisa o blusa', 'seco', 2.5],
    ['Camisa o blusa', 'planchado', 1.7],
    ['Camiseta', 'agua', 2.25],
    ['Camiseta', 'seco', 2.5],
  ] as const
).map(([nombre, metodo, precio]) => ({
  categoria: 'Doble y triple método',
  nombre_item: nombre,
  metodo,
  unidad: 'pieza' as const,
  precio_min: precio,
  precio_max: precio,
  cantidad_por_paquete: null,
  requiere_seleccion_metodo: true,
}))

const ROPA_SUELTA: FilaCatalogo[] = [
  fila('Ropa suelta', 'Lavado, secado y doblado', 0.7, 'libra'),
  fila('Ropa suelta', 'Solo lavado', 0.35, 'libra'),
  fila('Ropa suelta', 'Solo secado', 0.35, 'libra'),
]

const CORTINAS: FilaCatalogo[] = [
  fila('Cortinas', 'Cortinas visillos', 3.0, 'kilo'),
  fila('Cortinas', 'Cortinas pesadas', 3.5, 'kilo'),
]

const HOGAR: FilaCatalogo[] = [
  fila('Hogar y otros', 'Pantalón que no es de terno', 3.0),
  fila('Hogar y otros', 'Suéter de lana', 2.5),
  fila('Hogar y otros', 'Gorro', 2.5),
  fila('Hogar y otros', 'Bufanda', 3.0),
  fila('Hogar y otros', 'Mochila pequeña', 3.5),
  fila('Hogar y otros', 'Mochila grande', 5.0),
  fila('Hogar y otros', 'Almohada', 3.0),
  fila('Hogar y otros', 'Cojín', 2.5),
  fila('Hogar y otros', 'Edredón 2 plazas', 5.0),
  fila('Hogar y otros', 'Edredón 2 plazas y media', 6.0),
  fila('Hogar y otros', 'Edredón 3 plazas', 7.0),
  fila('Hogar y otros', 'Duvet', 5.0),
  { ...fila('Hogar y otros', 'Cobijas pequeñas', 12.0, 'paquete'), cantidad_por_paquete: 3 },
  {
    ...fila('Hogar y otros', 'Juego de sábanas más 2 fundas', 5.0, 'paquete'),
    cantidad_por_paquete: 1,
  },
  fila('Hogar y otros', 'Zapatos deportivos', 3.0, 'par'),
  { ...fila('Hogar y otros', 'Peluche grande', 5.0), precio_max: 7.0 },
  fila('Hogar y otros', 'Peluche mediano', 3.0),
  { ...fila('Hogar y otros', 'Peluche pequeño', 1.0), precio_max: 2.5 },
]

export const CATALOGO: FilaCatalogo[] = [
  ...ALFOMBRAS,
  ...LAVADO_EN_SECO,
  ...MULTIPLE_METODO,
  ...ROPA_SUELTA,
  ...CORTINAS,
  ...HOGAR,
]

/** La lista física tiene 54 filas. Si este número cambia, algo se perdió. */
export const TOTAL_ESPERADO = 54
