import { describe, expect, it } from 'vitest'
import { porNombre, workflow } from '../util/workflow.ts'

type Conexiones = Record<
  string,
  {
    main?: { node: string }[][]
    ai_tool?: { node: string }[][]
    ai_languageModel?: { node: string; index: number }[][]
  }
>
const c = workflow.connections as unknown as Conexiones

describe('laboratorio de modelos (agente de prueba)', () => {
  it('solo la bandeja de simulación llega al agente de laboratorio; un cliente real, nunca', () => {
    const condicion = JSON.stringify(porNombre('¿Es Prueba?')?.parameters)
    expect(condicion).toContain('PRUEBAS simulación (borrar)')
    // sin la bandeja de pruebas la condición es falsa: la rama por defecto (salida 1) es producción
    expect(c['¿Es Prueba?']?.main?.[1]?.[0]?.node).toBe('Agente Laundry VIP')
    expect(c['¿Es Prueba?']?.main?.[0]?.[0]?.node).toBe('Agente Laundry VIP (lab)')
    // «#prod» permite probar también la rama de producción desde la simulación
    expect(condicion).toContain("startsWith('#prod')")
  })

  it('el laboratorio comparte herramientas, memoria, respaldo y todo lo que va después', () => {
    for (const tool of [
      'cotizar_prendas',
      'verificar_cobertura',
      'crear_pedido',
      'find_or_create_client',
    ]) {
      const destinos = (c[tool]?.ai_tool?.[0] ?? []).map((d) => d.node)
      expect(destinos, tool).toEqual(['Agente Laundry VIP', 'Agente Laundry VIP (lab)'])
    }
    expect(c['Agente Laundry VIP (lab)']?.main?.[0]?.[0]?.node).toBe('Extraer JSON')
    expect(c['Gemini Lab']?.ai_languageModel?.[0]?.[0]).toMatchObject({
      node: 'Agente Laundry VIP (lab)',
      index: 0,
    })
    expect(c['OpenAI Laundry']?.ai_languageModel?.[0]?.map((d) => d.index)).toEqual([0, 1])
  })

  it('el agente de laboratorio tiene exactamente el mismo prompt que el de producción', () => {
    const prod = porNombre('Agente Laundry VIP')?.parameters
    const lab = porNombre('Agente Laundry VIP (lab)')?.parameters
    expect(JSON.stringify(lab)).toBe(JSON.stringify(prod))
  })
})
