import { describe, expect, it } from 'vitest'
import { listaDeSinonimos } from '@/lib/sinonimos'
import { puntuar, tokens, UMBRAL } from '@/server/pricing/normalizar'

/**
 * Cómo pide el cliente las cosas. Nació de dos fallos reales con clientes: el
 * agente respondió «no ofrecemos servicio de tinturado» y «no lavamos
 * zapatos», teniendo los dos en el catálogo. El cliente había escrito «hacen
 * tintura» y «lavado de zapatos».
 *
 * Es puro texto: no toca la base ni depende de precios que el dueño edita.
 */

const encuentra = (dicho: string, item: string, sinonimos: string[] = []) =>
  puntuar(dicho, item, sinonimos).cobertura >= UMBRAL

const SINONIMOS_TINTURADO = ['tintura', 'tinturar', 'tenido', 'tenir', 'tinte']
const SINONIMOS_ZAPATOS = ['zapato', 'zapatilla', 'tenis', 'calzado']

describe('las palabras con las que se pregunta no tapan la prenda', () => {
  it('«lavado de zapatos» encuentra los zapatos', () => {
    expect(encuentra('lavado de zapatos', 'Zapatos deportivos')).toBe(true)
  })

  it('«¿cuánto cuesta lavar un edredón?» encuentra el edredón', () => {
    expect(encuentra('cuanto cuesta lavar un edredon 3 plazas', 'Edredón 3 plazas')).toBe(true)
  })

  it('«¿tienen servicio de planchado de camisas?» encuentra la camisa', () => {
    expect(encuentra('tienen servicio de planchado de camisas', 'Camisa o blusa')).toBe(true)
  })

  it('pero si TODO lo que dijo son palabras de pregunta, esas mandan', () => {
    // «solo lavado» no puede quedarse sin nada que emparejar.
    expect(encuentra('solo lavado', 'Solo lavado')).toBe(true)
  })

  it('entre «Solo lavado» y «Solo secado», «solo lavado» gana el correcto', () => {
    const lavado = puntuar('solo lavado', 'Solo lavado')
    const secado = puntuar('solo secado', 'Solo secado')
    const cruzado = puntuar('solo lavado', 'Solo secado')
    expect(lavado.precision).toBeGreaterThan(cruzado.precision)
    expect(secado.precision).toBeGreaterThan(puntuar('solo secado', 'Solo lavado').precision)
  })
})

describe('los sinónimos del catálogo', () => {
  it('«hacen tintura» encuentra el tinturado', () => {
    expect(encuentra('hacen tintura', 'Tinturado', SINONIMOS_TINTURADO)).toBe(true)
  })

  it('«teñido» también, aunque el catálogo lo llame de otra forma', () => {
    expect(encuentra('tenido', 'Tinturado', SINONIMOS_TINTURADO)).toBe(true)
  })

  it('«tenis» y «zapatillas» encuentran los zapatos deportivos', () => {
    expect(encuentra('tenis', 'Zapatos deportivos', SINONIMOS_ZAPATOS)).toBe(true)
    expect(encuentra('unas zapatillas', 'Zapatos deportivos', SINONIMOS_ZAPATOS)).toBe(true)
  })

  it('sin sinónimos, esas mismas palabras no encontraban nada', () => {
    // El estado anterior al 2026-09-24, que es el que perdió clientes.
    expect(encuentra('hacen tintura', 'Tinturado')).toBe(false)
    expect(encuentra('tenis', 'Zapatos deportivos')).toBe(false)
  })

  it('un sinónimo no arrastra prendas que no tienen que ver', () => {
    expect(encuentra('tenis', 'Terno 3 piezas', ['traje'])).toBe(false)
    expect(encuentra('hacen tintura', 'Camisa o blusa', ['camisa', 'blusa'])).toBe(false)
  })
})

describe('la base del emparejador sigue en pie', () => {
  it('la cantidad que va delante no cuenta como prenda', () => {
    expect(tokens('3 camisetas')).toEqual(['camiseta'])
  })

  it('los números que distinguen prendas sí cuentan', () => {
    expect(tokens('edredón 3 plazas')).toEqual(['edredon', '3', 'plaza'])
  })

  it('mayúsculas y tildes dan igual', () => {
    expect(encuentra('3 CAMISETAS', 'Camiseta')).toBe(true)
    expect(encuentra('edredon 2 plazas', 'Edredón 2 plazas')).toBe(true)
  })
})

describe('los sinónimos que escribe el dueño en el CRM', () => {
  it('se limpian: sin espacios, sin vacíos y sin repetidos', () => {
    expect(listaDeSinonimos(' tintura ,, teñido,tintura , ')).toEqual(['tintura', 'teñido'])
  })

  it('un campo vacío deja el ítem sin sinónimos, no con uno en blanco', () => {
    expect(listaDeSinonimos('')).toEqual([])
    expect(listaDeSinonimos('  ,  ')).toEqual([])
  })
})
