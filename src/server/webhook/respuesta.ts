/**
 * Sobre único de respuesta. Todas las acciones responden con esta forma, sin
 * excepciones: así el agente en n8n nunca tiene que adivinar cómo leer nada.
 */
export type Sobre<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

export type CodigoError =
  | 'NO_AUTORIZADO'
  | 'CUERPO_INVALIDO'
  | 'ACCION_DESCONOCIDA'
  | 'PARAMETROS_INVALIDOS'
  | 'ITEMS_VACIOS'
  | 'CANTIDAD_INVALIDA'
  | 'NO_ENCONTRADO'
  | 'OPERADOR_NO_AUTORIZADO'
  | 'LIMITE_DIARIO_ALCANZADO'
  | 'ESTADO_INVALIDO'
  | 'ERROR_INTERNO'

export type ResultadoAccion<T> =
  | { ok: true; data: T }
  | { ok: false; codigo: CodigoError; mensaje: string; estadoHttp?: number }

export function exito<T>(data: T): ResultadoAccion<T> {
  return { ok: true, data }
}

export function fallo(
  codigo: CodigoError,
  mensaje: string,
  estadoHttp = 400,
): ResultadoAccion<never> {
  return { ok: false, codigo, mensaje, estadoHttp }
}

export function noEncontrado(mensaje: string): ResultadoAccion<never> {
  return fallo('NO_ENCONTRADO', mensaje, 404)
}
