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
    expect(c['OpenAI Laundry']?.ai_languageModel?.[0]?.map((d) => d.index)).toEqual([1, 1])
  })

  it('el laboratorio usa su propio prompt compacto y conserva las reglas duras', () => {
    const lab = porNombre('Agente Laundry VIP (lab)')?.parameters.options as {
      systemMessage: string
    }
    const texto = lab.systemMessage
    expect(texto.length).toBeLessThan(12_000)
    for (const regla of [
      'SOLO se escribe si salió de una herramienta',
      'cotizar_prendas',
      'verificar_cobertura',
      'obtener_proxima_ventana',
      'find_or_create_client',
      'crear_pedido',
      'NUNCA inventes el nombre',
      'NO mientas',
      'Decir que NO se ofrece un servicio',
      'Confirmar un pago',
      'escalar_humano',
      '"respuesta_lead"',
      'Ley de Protección de Datos Personales',
      'Nada de «combo» ni «a la carta»',
    ]) {
      expect(texto, regla).toContain(regla)
    }
  })

  it('la producción usa el prompt compacto del repo', () => {
    const prod = porNombre('Agente Laundry VIP')?.parameters.options as { systemMessage: string }
    expect(prod.systemMessage.length).toBeLessThan(12_000)
  })
})
