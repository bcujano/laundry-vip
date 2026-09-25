/**
 * Los sinónimos de un ítem del catálogo se escriben en el CRM separados por
 * comas: «tintura, teñido, tinte». Aquí se limpian antes de guardarlos, para
 * que el emparejador no reciba espacios sueltos, vacíos ni repetidos.
 */
export function listaDeSinonimos(crudo: string): string[] {
  const limpios = crudo
    .split(',')
    .map((palabra) => palabra.trim())
    .filter((palabra) => palabra !== '')

  return [...new Set(limpios)]
}
