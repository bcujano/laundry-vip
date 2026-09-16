import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * El agente clonado del 321. Se prueba que no arrastre nada de 321, que use
 * sus propias credenciales y que las reglas duras estén en la constitución.
 */
const RAIZ = resolve(import.meta.dirname, '../..')
const crudo = readFileSync(resolve(RAIZ, 'n8n/workflows/laundry-vip-agente.json'), 'utf8')
const prompt = readFileSync(resolve(RAIZ, 'n8n/prompt-agente-laundry.md'), 'utf8')

type Nodo = {
  name: string
  type: string
  parameters: Record<string, unknown>
  credentials?: Record<string, { id?: string; name: string }>
}
const workflow = JSON.parse(crudo) as {
  nodes: Nodo[]
  connections: Record<string, Record<string, { node: string }[][]>>
  settings: Record<string, unknown>
  active: boolean
}
const porNombre = (nombre: string) => workflow.nodes.find((n) => n.name === nombre)
const agente = porNombre('Agente Laundry VIP')
const systemMessage = String(
  (agente?.parameters.options as { systemMessage?: string })?.systemMessage,
)

describe('agente Laundry VIP (clon del 321)', () => {
  it('no arrastra nada de 321', () => {
    expect(crudo).not.toContain('accounts/1/')
    expect(crudo).not.toContain('937260122807094')
    expect(crudo).not.toContain('chatwoot-inmobiliaria')
    expect(crudo).not.toMatch(/321 (INMO|Soluciones)|Arqui|Inmo/i)
    expect(crudo).not.toMatch(/googleSheets|googleCalendar|gmail/i)
  })

  it('solo usa credenciales de Laundry VIP, salvo OpenAI que se reusa', () => {
    const nombres = new Set(
      workflow.nodes.flatMap((n) => Object.values(n.credentials ?? {}).map((c) => c.name)),
    )
    expect([...nombres].sort()).toEqual(
      [
        'CRM Laundry VIP Webhook',
        'Chatwoot Laundry VIP API',
        'Meta WhatsApp Laundry VIP',
        'OpenAi account',
        'Postgres Laundry VIP',
      ].sort(),
    )
  })

  it('escucha en su propia ruta y habla con la cuenta 3', () => {
    expect(porNombre('Chatwoot Webhook')?.parameters.path).toBe('laundry-vip')
    expect(String(porNombre('Enviar Respuesta Chatwoot')?.parameters.url)).toContain('accounts/3/')
    expect(workflow.active).toBe(false)
    expect(workflow.settings.timezone).toBe('America/Guayaquil')
  })

  it('transcribe con gpt-transcribe, nunca con el modelo viejo', () => {
    expect(crudo).not.toContain('whisper')
    expect(JSON.stringify(porNombre('Transcribir Audio')?.parameters)).toContain('gpt-transcribe')
  })

  it('cuelga las seis tools del CRM y la calculadora del agente', () => {
    const tools = Object.entries(workflow.connections)
      .filter(([, tipos]) => tipos.ai_tool?.[0]?.[0]?.node === 'Agente Laundry VIP')
      .map(([nombre]) => nombre)
      .sort()
    expect(tools).toEqual(
      [
        'Calculator',
        'calcular_vehiculo',
        'consultar_estado_pedido',
        'cotizar_prendas',
        'crear_pedido',
        'find_or_create_client',
        'obtener_proxima_ventana',
      ].sort(),
    )
  })

  it('la respuesta sale a Chatwoot y el escalamiento sigue vivo', () => {
    const destinos = workflow.connections['Extraer JSON']?.main?.[0]?.map((c) => c.node)
    expect(destinos).toContain('Enviar Respuesta Chatwoot')
    expect(destinos).toContain('Necesita Humano?')
  })

  it('la memoria va en su propia tabla', () => {
    expect(porNombre('Memory Laundry')?.parameters.tableName).toBe('n8n_laundry_chat_histories')
  })

  it('el prompt del JSON es el mismo que el .md', () => {
    expect(systemMessage).toBe(prompt.replace(/\n$/, ''))
  })

  it('la constitución trae las reglas duras', () => {
    expect(systemMessage).toContain('UN COMPROBANTE NUNCA CONFIRMA UN PAGO')
    expect(systemMessage).toContain('NO COTICES CONTANDO PRENDAS EN LA FOTO')
    expect(systemMessage).toContain('UNA MANCHA NO SE PROMETE')
    expect(systemMessage).toContain('NUNCA borra')
    expect(systemMessage).toContain('requiere_metodo')
    expect(systemMessage).toContain('sí explícito')
  })

  it('no hay ninguna llave literal', () => {
    expect(crudo).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/)
    expect(crudo).not.toMatch(/EAA[A-Za-z0-9]{20,}/)
    expect(crudo).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\./)
  })
})
