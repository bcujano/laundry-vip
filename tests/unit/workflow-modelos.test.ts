import { describe, expect, it } from 'vitest'
import { porNombre, workflow } from '../util/workflow.ts'

type Conexiones = Record<string, { ai_languageModel?: { node: string; index: number }[][] }>
const c = workflow.connections as unknown as Conexiones

describe('motor del agente de clientes: Gemini gratis principal y OpenAI de respaldo', () => {
  it('Gemini es la entrada principal (0) y OpenAI la de respaldo (1) del mismo agente', () => {
    // Como el agente de AIUDA Empresas: Gemini (gratis) primero, OpenAI cuando Gemini da error.
    expect(c['Gemini Laundry']?.ai_languageModel?.[0]?.[0]).toEqual({
      node: 'Agente Laundry VIP',
      type: 'ai_languageModel',
      index: 0,
    })
    expect(c['OpenAI Laundry']?.ai_languageModel?.[0]?.[0]).toMatchObject({
      node: 'Agente Laundry VIP',
      index: 1,
    })
  })

  it('el agente tiene el modelo de respaldo activado (nodo v3.1) y conserva su memoria y sus tools', () => {
    const agente = porNombre('Agente Laundry VIP') as unknown as {
      typeVersion: number
      parameters: { needsFallback?: boolean; options: { returnIntermediateSteps?: boolean } }
    }
    expect(agente.typeVersion).toBeGreaterThanOrEqual(3)
    expect(agente.parameters.needsFallback).toBe(true)
    // la guardia anti-alucinación lee los pasos intermedios de las tools
    expect(agente.parameters.options.returnIntermediateSteps).toBe(true)
  })

  it('Gemini usa la credencial por nombre (ninguna llave en el JSON) y el modelo de AIUDA', () => {
    const gemini = porNombre('Gemini Laundry') as unknown as {
      parameters: { modelName: string }
      credentials: { googlePalmApi: { name: string } }
    }
    expect(gemini.parameters.modelName).toBe('models/gemini-3-flash-preview')
    expect(gemini.credentials.googlePalmApi.name).toBe('Gemini Aiuda')
    expect(JSON.stringify(workflow)).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/)
  })

  it('el respaldo sigue siendo gpt-4.1-mini con salida JSON', () => {
    const openai = JSON.stringify(porNombre('OpenAI Laundry')?.parameters)
    expect(openai).toContain('gpt-4.1-mini')
    expect(openai).toContain('json_object')
  })

  it('el agente de planta y de la dueña sigue solo con OpenAI hasta probar sus tools con Gemini', () => {
    expect(c['OpenAI Operador']?.ai_languageModel?.[0]?.[0]?.index).toBe(0)
    expect(porNombre('Gemini Operador')).toBeUndefined()
  })
})

describe('nodo Agente v3: expresiones que sobreviven a las herramientas', () => {
  it('la memoria del agente de clientes usa .first() y no .item (con .item falla al llamar una tool)', () => {
    const memoria = JSON.stringify(porNombre('Memory Laundry')?.parameters)
    expect(memoria).toContain("$('WhatsApp Inicio').first()")
    expect(memoria).not.toContain("$('WhatsApp Inicio').item")
  })
})

describe('nodos que cuelgan del agente v3 no usan .item', () => {
  it('ningún nodo posterior al agente depende del emparejado de ítems de los nodos de un solo ítem', () => {
    const conexiones = workflow.connections as unknown as Record<
      string,
      { main?: { node: string }[][] }
    >
    const vistos = new Set<string>()
    const pila = ['Agente Laundry VIP']
    while (pila.length) {
      const actual = pila.pop() as string
      for (const salida of conexiones[actual]?.main ?? []) {
        for (const c of salida)
          if (!vistos.has(c.node)) {
            vistos.add(c.node)
            pila.push(c.node)
          }
      }
    }
    expect(vistos.size).toBeGreaterThan(5)
    const patron =
      /\$\('(WhatsApp Inicio|Preparar Mensaje Final|Extraer JSON|Verificar Operador|Chatwoot Webhook)'\)\.item\b/
    for (const nombre of vistos) {
      expect(JSON.stringify(porNombre(nombre)?.parameters), nombre).not.toMatch(patron)
    }
    // y la prueba que lo motivó: la URL de respuesta lleva el id de la conversación
    expect(JSON.stringify(porNombre('Enviar Respuesta Chatwoot')?.parameters.url)).toContain(
      "$('WhatsApp Inicio').first()",
    )
  })
})
