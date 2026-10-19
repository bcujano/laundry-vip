/**
 * Lógica pura para convertir la hoja de ProspectorVIP en prospectos del CRM. No importa nada: los
 * scripts no resuelven el alias `@/` y esto se prueba con vitest desde `tests/unit/prospectos.test.ts`.
 *
 * La hoja trae una columna «WhatsApp» que el dueño declaró inconsistente (14 filas no coinciden con
 * el teléfono, y varias son de una página de Linktree): NO se usa. Manda la columna «Teléfono».
 */

export type TipoTelefono = 'celular' | 'fijo' | 'sin_telefono'

export type TelefonoClasificado = {
  /** E.164 (+593…), o null si no hay un número utilizable. */
  telefono: string | null
  tipo: TipoTelefono
  /** Extensión de una central («ext. 1019»): no entra al número, se guarda en las notas. */
  extension: string | null
  /** Qué se asumió o por qué no se pudo usar. */
  nota: string | null
}

const PREFIJO_PAIS = '593'

/**
 * Formatos reales de la hoja: «098 700 1340» (celular), «(02) 397-0900» (fijo con código de área),
 * «326-0592» (fijo local, sin código: todos los negocios son de Quito, código 2) y «299-3300 ext. 1019».
 */
export function clasificarTelefono(original: string | null | undefined): TelefonoClasificado {
  const crudo = String(original ?? '').trim()
  if (crudo === '') return { telefono: null, tipo: 'sin_telefono', extension: null, nota: null }

  const coincidencia = /(?:ext\.?|extensi[oó]n|\bx)\s*(\d{1,6})/i.exec(crudo)
  const extension = coincidencia?.[1] ?? null
  const sinExtension = coincidencia ? crudo.slice(0, coincidencia.index) : crudo

  let digitos = sinExtension.replace(/\D/g, '')
  if (digitos.startsWith(PREFIJO_PAIS) && digitos.length >= 11) digitos = digitos.slice(3)
  if (digitos.startsWith('0')) digitos = digitos.slice(1)

  // Celular de Ecuador: 09 + 8 dígitos → 9 + 8.
  if (/^9\d{8}$/.test(digitos)) {
    return { telefono: `+${PREFIJO_PAIS}${digitos}`, tipo: 'celular', extension, nota: null }
  }
  // Fijo con código de área de un dígito (2 = Quito) + 7 dígitos.
  if (/^[2-7]\d{7}$/.test(digitos)) {
    return { telefono: `+${PREFIJO_PAIS}${digitos}`, tipo: 'fijo', extension, nota: null }
  }
  // Fijo local sin código de área: los negocios de la lista son de Quito.
  if (/^\d{7}$/.test(digitos)) {
    return {
      telefono: `+${PREFIJO_PAIS}2${digitos}`,
      tipo: 'fijo',
      extension,
      nota: 'La hoja no trae código de área: se asumió 02 (Quito).',
    }
  }
  return {
    telefono: null,
    tipo: 'sin_telefono',
    extension: null,
    nota: `Teléfono con un formato que no se reconoce: «${crudo}».`,
  }
}

/** Una fila de la hoja ya pasada a JSON por `scripts/prospectos_xlsx_a_json.py`. */
export type FilaHoja = {
  numero: number | string | null
  nombre: string | null
  direccion: string | null
  telefono: string | null
  emails: string | null
  website: string | null
  instagram: string | null
  rating: number | null
  reviews: number | null
  segmentos: string | null
  google_maps: string | null
}

export type ProspectoNuevo = {
  nombre: string
  segmento: string
  telefono: string | null
  tipo_telefono: TipoTelefono
  telefono_original: string | null
  direccion: string | null
  email: string | null
  sitio_web: string | null
  instagram: string | null
  google_maps: string | null
  rating: number | null
  resenas: number | null
  notas: string
  fuente: string
  fuente_ref: string
}

export type Descartado = { nombre: string; motivo: string }

/** Los segmentos que el dueño marcó en el filtro de la hoja el 2026-10-19. */
export const SEGMENTOS_DE_TRABAJO = [
  'catering',
  'centros de convenciones',
  'centros de convenciones; salones de eventos',
  'geriátricos; hogares de ancianos',
  'hogares de ancianos',
  'salones de eventos',
  'tiendas de alquiler de ropa',
] as const

const comparable = (texto: string) => texto.trim().toLowerCase().replace(/\s+/g, ' ')
const limpio = (valor: string | null | undefined) => {
  const texto = String(valor ?? '').trim()
  return texto === '' ? null : texto
}
const numero = (valor: unknown) =>
  typeof valor === 'number' && Number.isFinite(valor) ? valor : null

export function prepararProspectos(
  filas: FilaHoja[],
  opciones: { segmentos: readonly string[]; fuente: string },
): { prospectos: ProspectoNuevo[]; descartados: Descartado[] } {
  const buscados = new Set(opciones.segmentos.map(comparable))
  const prospectos: ProspectoNuevo[] = []
  const descartados: Descartado[] = []
  const duenoDelTelefono = new Map<string, string>()

  for (const fila of filas) {
    if (!buscados.has(comparable(String(fila.segmentos ?? '')))) continue

    const nombre = limpio(fila.nombre)
    if (nombre === null) {
      descartados.push({ nombre: `(fila ${fila.numero ?? '?'})`, motivo: 'no tiene nombre' })
      continue
    }

    const tel = clasificarTelefono(fila.telefono)
    if (tel.telefono !== null) {
      const previo = duenoDelTelefono.get(tel.telefono)
      if (previo !== undefined) {
        descartados.push({ nombre, motivo: `comparte teléfono con «${previo}»` })
        continue
      }
      duenoDelTelefono.set(tel.telefono, nombre)
    }

    const notas = [tel.extension ? `Extensión ${tel.extension}.` : null, tel.nota]
      .filter((n): n is string => n !== null)
      .join(' ')

    prospectos.push({
      nombre,
      segmento: comparable(String(fila.segmentos)),
      telefono: tel.telefono,
      tipo_telefono: tel.tipo,
      telefono_original: limpio(fila.telefono),
      direccion: limpio(fila.direccion),
      // La hoja trae varios correos separados por «;»: el primero basta para escribir.
      email: limpio(fila.emails?.split(';')[0]),
      sitio_web: limpio(fila.website),
      instagram: limpio(fila.instagram),
      google_maps: limpio(fila.google_maps),
      rating: numero(fila.rating),
      resenas: numero(fila.reviews),
      notas,
      fuente: opciones.fuente,
      fuente_ref: String(fila.numero ?? nombre),
    })
  }

  return { prospectos, descartados }
}
