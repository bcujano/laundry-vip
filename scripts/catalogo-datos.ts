/**
 * Carga inicial del catálogo: 54 filas, transcritas de la lista física de
 * precios (`catalogo_lavanderia.xlsx`, hoja «Base de Datos (sistema)»).
 * No se redondea, no se completa y no se "limpia".
 *
 * **Esto no es la fuente de verdad: lo es el CRM.** Lo que el dueño cambia en
 * pantalla manda, y `pnpm db:seed` ya no lo pisa (ver `db-seed.ts`).
 *
 * precio_min y precio_max son iguales salvo en los dos peluches con rango.
 * precio_paquete solo existe donde la lista trae una promoción por cantidad
 * (hoy solo las cobijas pequeñas: $5,00 cada una, 3 por $12,00).
 *
 * Las categorías son las de la lista del dueño: agrupan por prenda, no por
 * método de lavado. Los nombres de ítem no se tocan: el agente empareja lo que
 * dice el cliente contra `nombre_item` y el índice único es (nombre_item, metodo).
 */
export type FilaCatalogo = {
  categoria: string
  nombre_item: string
  metodo: 'unico' | 'agua' | 'seco' | 'planchado'
  unidad: 'pieza' | 'm2' | 'kilo' | 'libra' | 'paquete' | 'par'
  precio_min: number
  precio_max: number
  cantidad_por_paquete: number | null
  precio_paquete: number | null
  requiere_seleccion_metodo: boolean
  /** Cómo lo nombra el cliente. El dueño los edita en el CRM. */
  sinonimos: string[]
}

/**
 * Con qué palabras pide el cliente cada prenda. Sin esto, «¿hacen tintura?»
 * no encontraba «Tinturado» y el agente respondía que no se ofrecía.
 */
const SINONIMOS: Record<string, string[]> = {
  'Lavado, secado y doblado': [
    'ropa',
    'ropa suelta',
    'ropa de diario',
    'por libra',
    'por peso',
    'lavado por peso',
    'canasta de ropa',
  ],
  'Solo lavado': ['solo lavar', 'unicamente lavado'],
  'Solo secado': ['solo secar', 'secado de ropa'],
  'Cortinas visillos': ['visillo', 'cortina delgada', 'cortina liviana'],
  'Cortinas pesadas': ['cortina gruesa', 'blackout', 'cortina de sala'],
  'Mochila pequeña': ['mochila chica', 'morral'],
  'Mochila grande': ['mochila de viaje'],
  Almohada: ['almohadon'],
  Cojín: ['cojines decorativos'],
  'Edredón 2 plazas': ['cubrecama 2 plazas', 'edredon matrimonial', 'matrimonial'],
  'Edredón 2 plazas y media': ['edredon queen', 'queen'],
  'Edredón 3 plazas': ['edredon king', 'king'],
  'Edredón de plumas o en seco': ['plumon', 'edredon de plumas', 'edredon de pluma'],
  Duvet: ['cobertor duvet'],
  'Cobijas pequeñas': ['cobija', 'frazada', 'manta', 'cobertor'],
  'Juego de sábanas más 2 fundas': ['sabana', 'juego de sabanas', 'sabanas y fundas'],
  'Zapatos deportivos': [
    'zapato',
    'zapatilla',
    'tenis',
    'calzado',
    'deportivos',
    'zapatos de lona',
  ],
  'Peluche grande': ['muneco grande', 'oso de peluche grande'],
  'Peluche mediano': ['muneco mediano'],
  'Peluche pequeño': ['muneco pequeno', 'peluche chico'],
  'Alfombra de pelo corto': ['tapete de pelo corto', 'alfombra corta'],
  'Alfombra de pelo alto': ['tapete de pelo alto', 'alfombra peluda', 'alfombra alta'],
  'Terno 3 piezas': ['traje 3 piezas', 'terno completo', 'terno de 3'],
  'Terno 2 piezas': ['traje', 'terno', 'traje 2 piezas'],
  'Saco de terno': ['saco', 'blazer'],
  'Pantalón de terno': ['pantalon de vestir'],
  'Abrigo liviano o gabardina': ['gabardina', 'abrigo liviano', 'sobretodo'],
  'Abrigo pesado': ['abrigo', 'abrigo grueso'],
  'Camisa o blusa': ['camisa', 'blusa'],
  Camiseta: ['polo', 'playera', 'camiseta de algodon'],
  Chal: ['pashmina'],
  Chaleco: ['chaleco de plumon', 'chaleco de lana'],
  Chompa: ['casaca', 'chaqueta', 'chompa de lana'],
  'Chompa de cuero': ['casaca de cuero', 'chaqueta de cuero', 'cuero'],
  'Falda corta': ['falda', 'minifalda'],
  'Falda larga': ['falda hasta el piso'],
  'Pantalón que no es de terno': ['pantalon', 'jean', 'jeans', 'bluyin'],
  'Suéter de lana': ['sueter', 'sweater', 'pullover'],
  Gorro: ['gorra'],
  Bufanda: ['chalina'],
  Mandil: ['delantal'],
  'Mantel pequeño': ['mantel chico'],
  'Mantel mediano': ['mantel'],
  'Mantel grande': ['mantel de banquete'],
  'Vestido corto': ['vestido'],
  'Vestido largo de fiesta': ['vestido de fiesta', 'vestido largo', 'vestido de gala'],
  'Vestido de primera comunión': ['vestido de comunion', 'comunion'],
  'Vestido de novia sencillo': ['vestido de novia', 'novia'],
  'Vestido de novia con cola': ['novia con cola', 'vestido de novia con cola'],
  Enterizo: ['overol', 'jumpsuit'],
  Tinturado: ['tintura', 'tinturar', 'tenido', 'tenir', 'tinte', 'cambio de color'],
}

function fila(
  categoria: string,
  nombre_item: string,
  precio: number,
  unidad: FilaCatalogo['unidad'] = 'pieza',
  metodo: FilaCatalogo['metodo'] = 'unico',
): FilaCatalogo {
  return {
    categoria,
    nombre_item,
    metodo,
    unidad,
    precio_min: precio,
    precio_max: precio,
    cantidad_por_paquete: null,
    precio_paquete: null,
    requiere_seleccion_metodo: false,
    sinonimos: SINONIMOS[nombre_item] ?? [],
  }
}

const LAVADO_EN_AGUA: FilaCatalogo[] = [
  fila('Lavado en agua', 'Lavado, secado y doblado', 0.7, 'libra', 'agua'),
  fila('Lavado en agua', 'Solo lavado', 0.35, 'libra', 'agua'),
  fila('Lavado en agua', 'Solo secado', 0.35, 'libra', 'agua'),
]

const CORTINAS: FilaCatalogo[] = [
  fila('Cortinas', 'Cortinas visillos', 3.0, 'kilo', 'agua'),
  fila('Cortinas', 'Cortinas pesadas', 3.5, 'kilo', 'agua'),
]

const MOCHILAS: FilaCatalogo[] = [
  fila('Mochilas', 'Mochila pequeña', 3.5, 'pieza', 'agua'),
  fila('Mochilas', 'Mochila grande', 5.0, 'pieza', 'agua'),
]

const ROPA_DE_CAMA: FilaCatalogo[] = [
  fila('Ropa de cama', 'Almohada', 3.0, 'pieza', 'agua'),
  fila('Ropa de cama', 'Cojín', 2.5, 'pieza', 'agua'),
  fila('Ropa de cama', 'Edredón 2 plazas', 5.0, 'pieza', 'agua'),
  fila('Ropa de cama', 'Edredón 2 plazas y media', 6.0, 'pieza', 'agua'),
  fila('Ropa de cama', 'Edredón 3 plazas', 7.0, 'pieza', 'agua'),
  fila('Ropa de cama', 'Edredón de plumas o en seco', 8.0, 'pieza', 'seco'),
  // El duvet va en agua o en seco según la prenda: lo decide la planta.
  fila('Ropa de cama', 'Duvet', 5.0),
  // $5,00 cada una y la promoción de la lista: 3 por $12,00.
  {
    ...fila('Ropa de cama', 'Cobijas pequeñas', 5.0, 'pieza', 'agua'),
    cantidad_por_paquete: 3,
    precio_paquete: 12.0,
  },
  {
    ...fila('Ropa de cama', 'Juego de sábanas más 2 fundas', 5.0, 'paquete', 'agua'),
    cantidad_por_paquete: 1,
  },
]

const CALZADO: FilaCatalogo[] = [fila('Calzado', 'Zapatos deportivos', 3.0, 'par', 'agua')]

const PELUCHES: FilaCatalogo[] = [
  { ...fila('Peluches', 'Peluche grande', 5.0, 'pieza', 'agua'), precio_max: 7.0 },
  fila('Peluches', 'Peluche mediano', 3.0, 'pieza', 'agua'),
  { ...fila('Peluches', 'Peluche pequeño', 1.0, 'pieza', 'agua'), precio_max: 2.5 },
]

const ALFOMBRAS: FilaCatalogo[] = [
  fila('Alfombras', 'Alfombra de pelo corto', 7.0, 'm2', 'agua'),
  fila('Alfombras', 'Alfombra de pelo alto', 8.0, 'm2', 'agua'),
]

const TRAJES_Y_ABRIGOS: FilaCatalogo[] = [
  ['Terno 3 piezas', 8.5],
  ['Terno 2 piezas', 7.5],
  ['Saco de terno', 3.75],
  ['Pantalón de terno', 3.75],
  ['Abrigo liviano o gabardina', 5.5],
  ['Abrigo pesado', 7.5],
].map(([nombre, precio]) =>
  fila('Trajes y abrigos', nombre as string, precio as number, 'pieza', 'seco'),
)

// Los dos únicos ítems donde el agente DEBE preguntar el método antes de cotizar.
const CAMISAS_Y_BLUSAS: FilaCatalogo[] = (
  [
    ['Camisa o blusa', 'agua', 2.25],
    ['Camisa o blusa', 'seco', 2.5],
    ['Camisa o blusa', 'planchado', 1.7],
    ['Camiseta', 'agua', 2.25],
    ['Camiseta', 'seco', 2.5],
  ] as const
).map(([nombre, metodo, precio]) => ({
  ...fila('Camisas y blusas', nombre, precio),
  metodo,
  requiere_seleccion_metodo: true,
}))

const PRENDAS_DE_VESTIR: FilaCatalogo[] = [
  ['Chal', 3.0],
  ['Chaleco', 3.5],
  ['Chompa', 5.5],
  ['Falda corta', 3.5],
  ['Falda larga', 4.5],
  ['Pantalón que no es de terno', 3.0],
  ['Suéter de lana', 2.5],
  ['Gorro', 2.5],
  ['Bufanda', 3.0],
].map(([nombre, precio]) =>
  fila('Prendas de vestir', nombre as string, precio as number, 'pieza', 'seco'),
)

const MANTELERIA: FilaCatalogo[] = [
  ['Mandil', 4.0],
  ['Mantel pequeño', 3.5],
  ['Mantel mediano', 4.0],
  ['Mantel grande', 5.0],
].map(([nombre, precio]) => fila('Mantelería', nombre as string, precio as number, 'pieza', 'seco'))

const VESTIDOS_ESPECIALES: FilaCatalogo[] = [
  ['Vestido corto', 5.0],
  ['Vestido largo de fiesta', 7.0],
  ['Vestido de primera comunión', 6.0],
  ['Vestido de novia sencillo', 20.5],
  ['Vestido de novia con cola', 25.5],
  ['Enterizo', 5.0],
].map(([nombre, precio]) =>
  fila('Vestidos especiales', nombre as string, precio as number, 'pieza', 'seco'),
)

const OTROS: FilaCatalogo[] = [
  fila('Otros', 'Tinturado', 6.0),
  fila('Otros', 'Chompa de cuero', 8.0),
]

export const CATALOGO: FilaCatalogo[] = [
  ...LAVADO_EN_AGUA,
  ...CORTINAS,
  ...MOCHILAS,
  ...ROPA_DE_CAMA,
  ...CALZADO,
  ...PELUCHES,
  ...ALFOMBRAS,
  ...TRAJES_Y_ABRIGOS,
  ...CAMISAS_Y_BLUSAS,
  ...PRENDAS_DE_VESTIR,
  ...MANTELERIA,
  ...VESTIDOS_ESPECIALES,
  ...OTROS,
]

/**
 * Cuántas filas trae la lista inicial. NO es cuántas debe tener la base: el
 * dueño agrega y quita ítems desde el CRM, y el CRM es la fuente de verdad.
 */
export const TOTAL_LISTA_INICIAL = 54
