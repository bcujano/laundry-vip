/**
 * Texto del aviso al cliente cuando hay una discrepancia. Lo arma el servidor con
 * cifras de la base: el modelo no interviene, así que no puede inventar un monto.
 * Es solo informativo: no pide pago, no da cuentas y no negocia.
 */

export type DatosAviso =
  | {
      tipo: 'discrepancia_conteo'
      nombre: string | null
      montoAnterior: number
      montoNuevo: number
      diferencias: { descripcion: string; declarada: number; real: number }[]
    }
  | {
      tipo: 'correccion_monto'
      nombre: string | null
      montoAnterior: number
      montoNuevo: number
      motivo: string
    }

/** `Omit` no distribuye sobre una unión: este sí. */
export type DatosSinNombre = DatosAviso extends infer T
  ? T extends unknown
    ? Omit<T, 'nombre'>
    : never
  : never

const dinero = (n: number) => `$${n.toFixed(2).replace('.', ',')}`

export function textoAviso(d: DatosAviso): string {
  const saludo = d.nombre ? `Hola, ${d.nombre}.` : 'Hola.'
  const cierre =
    'Si algo no le cuadra, una persona del equipo le atiende con gusto. Por ahora no necesita hacer nada.'

  if (d.tipo === 'discrepancia_conteo') {
    const lineas = d.diferencias
      .map((x) => `• ${x.descripcion}: usted indicó ${x.declarada} y contamos ${x.real}`)
      .join('\n')
    return [
      `${saludo} Al contar su ropa en planta encontramos una diferencia con lo que nos indicó:`,
      lineas,
      `Por eso el valor del lavado pasa de ${dinero(d.montoAnterior)} a ${dinero(d.montoNuevo)}.`,
      cierre,
    ].join('\n')
  }

  return [
    `${saludo} Revisamos su pedido y el valor del lavado cambia de ${dinero(d.montoAnterior)} a ${dinero(d.montoNuevo)}.`,
    `Motivo: ${d.motivo.trim()}.`,
    cierre,
  ].join('\n')
}
