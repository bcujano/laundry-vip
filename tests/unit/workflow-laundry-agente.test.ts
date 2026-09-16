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

describe('registro en el CRM en cada turno (patrón del CRM de 321)', () => {
  it('después del parser registra cliente y conversación, sin frenar la respuesta', () => {
    expect(workflow.connections['Extraer JSON']?.main?.[0]?.map((c) => c.node)).toContain(
      'Preparar CRM Body',
    )
    expect(workflow.connections['Preparar CRM Body']?.main?.[0]?.[0]?.node).toBe(
      'Registrar Cliente CRM',
    )
    expect(workflow.connections['Registrar Cliente CRM']?.main?.[0]?.[0]?.node).toBe(
      'Registrar Conversacion CRM',
    )
    for (const nombre of ['Registrar Cliente CRM', 'Registrar Conversacion CRM']) {
      const nodo = workflow.nodes.find((n) => n.name === nombre) as Nodo & { onError?: string }
      expect(nodo.onError).toBe('continueRegularOutput')
      expect(nodo.credentials?.httpHeaderAuth?.name).toBe('CRM Laundry VIP Webhook')
    }
  })

  it('usa las acciones del webhook y no mete el perfil de WhatsApp como nombre', () => {
    const codigo = String(porNombre('Preparar CRM Body')?.parameters.jsCode)
    expect(codigo).toContain("accion: 'find_or_create_client'")
    expect(codigo).toContain("accion: 'sincronizar_memoria_conversacion'")
    expect(codigo).toContain('ext.lead_nombre !== perfil')
  })
})

describe('modo operador (lista blanca de planta)', () => {
  const promptOperador = readFileSync(resolve(RAIZ, 'n8n/prompt-operador-laundry.md'), 'utf8')
  const destinos = (nombre: string) =>
    (workflow.connections[nombre]?.main ?? []).map((salida) => salida.map((c) => c.node))

  it('verifica la lista blanca y bifurca entre operador y cliente', () => {
    expect(destinos('Typing Indicator')).toEqual([['Verificar Operador']])
    expect(destinos('Verificar Operador')).toEqual([['¿Es Operador?']])
    expect(destinos('¿Es Operador?')).toEqual([['Agente Operador'], ['Agente Laundry VIP']])
    expect(destinos('Agente Operador')).toEqual([['Extraer JSON']])
  })

  it('el agente de planta tiene sus tools, su memoria y su constitución', () => {
    const tools = Object.entries(workflow.connections)
      .filter(([, tipos]) => tipos.ai_tool?.[0]?.[0]?.node === 'Agente Operador')
      .map(([nombre]) => nombre)
      .sort()
    expect(tools).toEqual(
      [
        'actualizar_registro',
        'confirmar_pago',
        'consultar_pedido',
        'corregir_cotizacion',
        'cotizar_prendas_operador',
        'generar_reporte',
        'registrar_cliente_presencial',
      ].sort(),
    )
    expect(String(porNombre('Memory Operador')?.parameters.sessionKey)).toContain('operador_')
    const opciones = porNombre('Agente Operador')?.parameters.options as { systemMessage: string }
    expect(opciones.systemMessage).toBe(promptOperador.replace(/\n$/, ''))
    expect(opciones.systemMessage).toContain('NUNCA borra')
  })

  it('las acciones de operador llevan el teléfono del que escribe, no uno que invente el modelo', () => {
    for (const nombre of [
      'registrar_cliente_presencial',
      'actualizar_registro',
      'confirmar_pago',
    ]) {
      const cuerpo = String(porNombre(nombre)?.parameters.jsonBody)
      expect(cuerpo).toContain('telefono_operador')
      expect(cuerpo).toContain("$('WhatsApp Inicio').first().json.contacts[0].wa_id")
    }
  })

  it('el parser lee al agente que corrió y el operador no se registra como lead', () => {
    expect(String(porNombre('Extraer JSON')?.parameters.jsCode)).toContain(
      '$input.first().json.output',
    )
    expect(String(porNombre('Preparar CRM Body')?.parameters.jsCode)).toContain(
      'if (esOperador) return []',
    )
  })
})

describe('guardia anti-alucinación', () => {
  it('los agentes devuelven los pasos intermedios para poder auditar las tools', () => {
    for (const nombre of ['Agente Laundry VIP', 'Agente Operador']) {
      const opciones = porNombre(nombre)?.parameters.options as {
        returnIntermediateSteps?: boolean
      }
      expect(opciones.returnIntermediateSteps).toBe(true)
    }
  })

  it('una confirmación sin tool ok:true o con un ID que no salió de una tool se reemplaza', () => {
    const codigo = String(porNombre('Extraer JSON')?.parameters.jsCode)
    expect(codigo).toContain('intermediateSteps')
    expect(codigo).toContain('idInventado')
    expect(codigo).toContain('escrituraFantasma')
    expect(codigo).toContain('La orden NO quedó registrada')
  })
})
