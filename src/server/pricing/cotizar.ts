import { supabaseAdmin } from '@/lib/supabase/admin'
import type { MetodoServicio, Servicio } from '@/types/database'
import { puntuar, UMBRAL } from './normalizar'

/**
 * Motor de precios: fuente única de verdad. El webhook del agente nunca
 * calcula un precio por su cuenta, siempre llama aquí.
 *
 * Reglas que no se negocian:
 *   - Nunca se asume un método cuando el ítem admite varios.
 *   - Nunca se inventa un precio para algo que no está en el catálogo.
 *   - Nunca se elige un extremo de un rango.
 *   - Todo lo que sale de aquí es un ESTIMADO, pendiente de verificación en planta.
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
  /** Varios ítems del catálogo encajan con lo que dijo: hay que preguntar. */
  requiere_desambiguacion?: boolean
  opciones?: { nombre_item: string; precio_min: number; precio_max: number; unidad: string }[]
  /** Los dos peluches tienen rango; no se elige un extremo. */
  es_rango?: boolean
  precio_min?: number
  precio_max?: number
  /** Ítems que se cobran por paquete cerrado. */
  paquetes_cobrados?: number
  nota?: string
}

export type Cotizacion = {
  lineas: LineaCotizada[]
  resumen: {
    /** Siempre. Un estimado no es un cobro. */
    estado: 'estimado_pendiente_verificacion'
    subtotal: number
    lineas_con_precio: number
    lineas_sin_precio: number
    requiere_respuesta_del_cliente: boolean
  }
}

export class ErrorCotizacion extends Error {
  constructor(
    readonly codigo: 'ITEMS_VACIOS' | 'CANTIDAD_INVALIDA',
    mensaje: string,
  ) {
    super(mensaje)
  }
}

const NOTA_SIN_PRECIO = 'a confirmar por el operador'

async function catalogoActivo(): Promise<Servicio[]> {
  const { data, error } = await supabaseAdmin().from('servicios').select('*').eq('activo', true)
  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`)
  return (data ?? []) as Servicio[]
}

type Grupo = { nombre_item: string; filas: Servicio[] }

function agrupar(catalogo: Servicio[]): Grupo[] {
  const porNombre = new Map<string, Servicio[]>()
  for (const fila of catalogo) {
    const filas = porNombre.get(fila.nombre_item) ?? []
    filas.push(fila)
    porNombre.set(fila.nombre_item, filas)
  }
  return [...porNombre.entries()].map(([nombre_item, filas]) => ({ nombre_item, filas }))
}

/**
 * Empareja la descripción con el catálogo.
 * `ganador` solo viene si uno destaca sin empate; si empatan, `finalistas`
 * trae todas las opciones plausibles para preguntarle al cliente.
 */
function emparejar(descripcion: string, grupos: Grupo[]): { ganador?: Grupo; finalistas: Grupo[] } {
  const puntuados = grupos
    .map((grupo) => ({ grupo, puntaje: puntuar(descripcion, grupo.nombre_item) }))
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

function cotizarGrupo(item: ItemPedido, grupo: Grupo): LineaCotizada {
  const base = { descripcion: item.descripcion, cantidad: item.cantidad, encontrado: true }
  const metodosDisponibles = grupo.filas.map((fila) => fila.metodo)
  const exigeMetodo = grupo.filas.some((fila) => fila.requiere_seleccion_metodo)

  // Nunca se asume un método. Se pregunta y se devuelve SIN precio.
  if (exigeMetodo && !item.metodo) {
    return {
      ...base,
      nombre_item: grupo.nombre_item,
      requiere_metodo: true,
      metodos_disponibles: metodosDisponibles,
      nota: `"${grupo.nombre_item}" se puede lavar de varias formas. Hay que preguntar cuál.`,
    }
  }

  const fila = item.metodo
    ? grupo.filas.find((f) => f.metodo === item.metodo)
    : (grupo.filas[0] as Servicio | undefined)

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
    unidad: fila.unidad,
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
    const subtotal = paquetes * precioPaquete + sueltas * precioMin
    return {
      ...comun,
      precio_unitario: precioMin,
      paquetes_cobrados: paquetes,
      subtotal: redondear(subtotal),
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

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

/**
 * Cotiza una lista de prendas contra el catálogo real. Es lectura pura: no
 * escribe absolutamente nada.
 */
export async function cotizarPrendas(items: ItemPedido[]): Promise<Cotizacion> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ErrorCotizacion('ITEMS_VACIOS', 'No se recibió ninguna prenda para cotizar.')
  }
  for (const item of items) {
    if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      throw new ErrorCotizacion(
        'CANTIDAD_INVALIDA',
        `La cantidad de "${item.descripcion}" debe ser mayor que cero.`,
      )
    }
  }

  const grupos = agrupar(await catalogoActivo())

  const lineas = items.map((item): LineaCotizada => {
    const { ganador, finalistas } = emparejar(item.descripcion, grupos)

    // Nada se parece: nunca se inventa un precio.
    if (finalistas.length === 0) {
      return {
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        encontrado: false,
        nota: NOTA_SIN_PRECIO,
      }
    }

    // Varias prendas distintas encajan: se pregunta, no se adivina.
    if (!ganador) {
      return {
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        encontrado: false,
        requiere_desambiguacion: true,
        opciones: finalistas.map((grupo) => {
          const fila = grupo.filas[0] as Servicio
          return {
            nombre_item: grupo.nombre_item,
            precio_min: Number(fila.precio_min),
            precio_max: Number(fila.precio_max),
            unidad: fila.unidad,
          }
        }),
        nota: 'Hay varias opciones con ese nombre. Hay que preguntar cuál es.',
      }
    }

    return cotizarGrupo(item, ganador)
  })

  const conPrecio = lineas.filter((linea) => linea.subtotal !== undefined)

  return {
    lineas,
    resumen: {
      estado: 'estimado_pendiente_verificacion',
      subtotal: redondear(conPrecio.reduce((suma, linea) => suma + (linea.subtotal ?? 0), 0)),
      lineas_con_precio: conPrecio.length,
      lineas_sin_precio: lineas.length - conPrecio.length,
      requiere_respuesta_del_cliente: lineas.some(
        (linea) => linea.requiere_metodo || linea.requiere_desambiguacion,
      ),
    },
  }
}

/** 1 funda cabe en moto; más de 1 necesita auto. Nada que ver con las prendas. */
export function calcularVehiculo(numeroFundas: number): 'moto' | 'auto' {
  if (!Number.isFinite(numeroFundas) || numeroFundas < 1) {
    throw new ErrorCotizacion('CANTIDAD_INVALIDA', 'El número de fundas debe ser al menos 1.')
  }
  return numeroFundas === 1 ? 'moto' : 'auto'
}
