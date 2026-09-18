/**
 * CSV que Excel en español abre bien a la primera: separador «;», coma
 * decimal y BOM para que las tildes y la ñ no salgan rotas.
 */

export type Columna<T> = { titulo: string; valor: (fila: T) => unknown }

const BOM = '﻿'

function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  const texto =
    typeof valor === 'number'
      ? String(valor).replace('.', ',')
      : typeof valor === 'boolean'
        ? valor
          ? 'Sí'
          : 'No'
        : String(valor)
  // Comillas si trae separador, comillas o saltos de línea; las internas se duplican.
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

export function aCsv<T>(filas: T[], columnas: Columna<T>[]): string {
  const cabecera = columnas.map((c) => celda(c.titulo)).join(';')
  const cuerpo = filas.map((fila) => columnas.map((c) => celda(c.valor(fila))).join(';'))
  return `${BOM}${[cabecera, ...cuerpo].join('\r\n')}\r\n`
}

/** Fecha y hora de Quito, legible en Excel: 2026-09-17 14:05. */
export function fechaCsv(valor: string | null | undefined): string {
  if (!valor) return ''
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor))
  return partes
}

export function respuestaCsv(nombre: string, contenido: string): Response {
  const hoy = fechaCsv(new Date().toISOString()).slice(0, 10)
  return new Response(contenido, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nombre}-${hoy}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
