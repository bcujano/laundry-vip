import { randomInt } from 'node:crypto'

/**
 * Identificador irrepetible para los datos de una corrida de pruebas.
 *
 * Antes esto era `String(Date.now()).slice(-6)`, que parece único pero NO lo
 * es: los últimos 6 dígitos de un timestamp en milisegundos se repiten cada
 * 10^6 ms, o sea cada ~16,7 minutos. Si una corrida anterior dejó filas sin
 * limpiar, la siguiente chocaba contra `clientes_telefono_key` y fallaban
 * pruebas que no tenían nada malo.
 *
 * Con 6 dígitos aleatorios la colisión es de 1 en un millón por corrida, y
 * además no depende de cuándo se ejecute.
 */
export function corrida(): string {
  return String(randomInt(100_000, 1_000_000))
}

/** Prefijo E.164 de pruebas: +5939 + los 6 dígitos de la corrida. */
export function prefijoTelefono(id = corrida()): string {
  return `+5939${id}`
}
