import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Del modelo se prueban los parámetros y el texto de la constitución, jamás lo
 * que genera. Ningún gate depende de una cuenta externa viva.
 */
const RUTA = resolve(import.meta.dirname, '../../n8n/workflows/lavanderia-vip-agente.json')
const crudo = readFileSync(RUTA, 'utf8')
const workflow = JSON.parse(crudo) as {
  nodes: {
    name: string
    type: string
    parameters: Record<string, unknown>
    notes?: string
  }[]
  connections: Record<string, unknown>
  settings: Record<string, unknown>
}

const nodos = workflow.nodes
const porNombre = (nombre: string) => nodos.find((n) => n.name === nombre)

const constituciones = porNombre('Cargar constituciones')
const asignaciones = (
  (constituciones?.parameters.assignments as { assignments: { name: string; value: string }[] })
    ?.assignments ?? []
).reduce<Record<string, string>>((mapa, item) => {
  mapa[item.name] = item.value
  return mapa
}, {})

const CONSTITUCION_CLIENTE = asignaciones.constitucion_cliente ?? ''
const CONSTITUCION_OPERADOR = asignaciones.constitucion_operador ?? ''

const nodosOpenAI = nodos.filter((nodo) =>
  String(nodo.parameters.url ?? '').includes('api.openai.com/v1/chat/completions'),
)

describe('estructura del workflow', () => {
  it('es un JSON válido con las dos ramas en un solo archivo', () => {
    expect(nodos.length).toBeGreaterThan(20)
    expect(porNombre('IF operador o cliente')).toBeDefined()
    expect(porNombre('Cliente: planificar accion (Tool First 1)')).toBeDefined()
    expect(porNombre('Operador: planificar accion (Tool First 1)')).toBeDefined()
  })

  it('tiene los nodos que exige el diseño', () => {
    for (const nombre of [
      'Mensaje entrante (POST)',
      'Es un mensaje valido?',
      'Debounce 30s',
      'Buscar o crear cliente',
      'Cargar memoria',
      'Extraer respuesta',
      'Avisar al operador del pedido nuevo',
      'Preparar solicitud de despacho',
      'Espejar en Chatwoot',
      'Responder por WhatsApp',
      'Idempotencia y costo',
    ]) {
      expect(porNombre(nombre), `falta el nodo "${nombre}"`).toBeDefined()
    }
  })

  it('corre en la zona horaria de Quito', () => {
    expect(workflow.settings.timezone).toBe('America/Guayaquil')
  })

  it('el debounce espera 30 segundos', () => {
    expect(porNombre('Debounce 30s')?.parameters.amount).toBe(30)
    expect(porNombre('Debounce 30s')?.parameters.unit).toBe('seconds')
  })

  it('la idempotencia va por el message_id de WhatsApp', () => {
    const cuerpo = String(porNombre('Idempotencia y costo')?.parameters.jsonBody)
    expect(cuerpo).toContain('dedupe_key')
    expect(String(porNombre('Extraer mensaje y referral')?.parameters.jsCode)).toContain(
      'dedupe_key: mensaje.id',
    )
  })
})

describe('receta anti-alucinación', () => {
  it('hay cuatro llamadas a OpenAI: Tool First en las dos ramas', () => {
    expect(nodosOpenAI).toHaveLength(4)
  })

  it('todas declaran temperature 0, top_p 0.1 y json_object', () => {
    for (const nodo of nodosOpenAI) {
      const cuerpo = String(nodo.parameters.jsonBody)
      expect(cuerpo, `${nodo.name} sin temperature`).toContain('temperature: 0')
      expect(cuerpo, `${nodo.name} sin top_p`).toContain('top_p: 0.1')
      expect(cuerpo, `${nodo.name} sin json_object`).toContain("type: 'json_object'")
    }
  })

  it('todas usan gpt-4.1-mini', () => {
    for (const nodo of nodosOpenAI) {
      expect(String(nodo.parameters.jsonBody)).toContain("model: 'gpt-4.1-mini'")
    }
  })

  it('la segunda llamada redacta solo con datos del CRM', () => {
    for (const nombre of [
      'Cliente: redactar respuesta (Tool First 2)',
      'Operador: redactar respuesta (Tool First 2)',
    ]) {
      expect(String(porNombre(nombre)?.parameters.jsonBody)).toContain('UNICAMENTE')
    }
  })

  it('las dos constituciones dicen Tool First', () => {
    expect(CONSTITUCION_CLIENTE).toContain('Tool First')
    expect(CONSTITUCION_OPERADOR).toContain('Tool First')
  })

  it('ninguna llamada reintenta y todas cortan a los 30 segundos', () => {
    for (const nodo of nodosOpenAI) {
      expect((nodo.parameters.options as { timeout: number }).timeout).toBe(30000)
      expect(nodo.parameters.retryOnFail).toBeUndefined()
    }
  })
})

describe('constitución del cliente', () => {
  it('exige el trato de usted', () => {
    expect(CONSTITUCION_CLIENTE).toContain('de usted')
    expect(CONSTITUCION_CLIENTE).toContain('Nunca tutees')
  })

  it('prohíbe inventar precios y fechas', () => {
    expect(CONSTITUCION_CLIENTE).toContain('NUNCA INVENTES')
    expect(CONSTITUCION_CLIENTE).toContain('Ningun precio')
    expect(CONSTITUCION_CLIENTE).toContain('Ninguna fecha')
  })

  it('marca todo monto como estimado pendiente de verificación', () => {
    expect(CONSTITUCION_CLIENTE).toContain('ESTIMADO PENDIENTE DE VERIFICACION')
  })

  it('separa las fundas de las prendas', () => {
    expect(CONSTITUCION_CLIENTE).toContain('FUNDAS Y PRENDAS SON COSAS DISTINTAS')
    expect(CONSTITUCION_CLIENTE).toContain('1 funda moto')
  })

  it('exige confirmación explícita antes de crear un pedido', () => {
    expect(CONSTITUCION_CLIENTE).toContain('CONFIRMACION EXPLICITA')
    expect(CONSTITUCION_CLIENTE).toContain('espera un SI explicito')
  })

  it('nunca rechaza por horario', () => {
    expect(CONSTITUCION_CLIENTE).toContain('nunca rechaces por horario')
  })

  it('manda el aviso de privacidad una sola vez', () => {
    expect(CONSTITUCION_CLIENTE).toContain('LOPDP')
    expect(CONSTITUCION_CLIENTE).toContain('una sola vez')
  })

  it('la lista de escalación es cerrada y literal', () => {
    expect(CONSTITUCION_CLIENTE).toContain('Esta lista es cerrada')
    expect(CONSTITUCION_CLIENTE).toContain('NO escala')

    for (const frase of [
      'quiero hablar con una persona',
      'quiero hablar con un humano',
      'pasame con alguien',
      'quiero poner una queja',
      'me perdieron una prenda',
    ]) {
      expect(CONSTITUCION_CLIENTE, `falta la frase "${frase}"`).toContain(frase)
    }
  })
})

describe('constitución del operador', () => {
  it('dice explícitamente que ese canal no borra', () => {
    expect(CONSTITUCION_OPERADOR).toContain('ESTE CANAL NUNCA BORRA NADA')
    expect(CONSTITUCION_OPERADOR).toContain('eliminar exige entrar al CRM')
    expect(CONSTITUCION_OPERADOR).toContain('No hay excepciones')
  })

  it('corrige el mismo pedido en vez de crear otro', () => {
    expect(CONSTITUCION_OPERADOR).toContain('MISMO pedido')
    expect(CONSTITUCION_OPERADOR).toContain('nunca crea uno nuevo')
  })

  it('exige avisar al cliente antes de cobrar un monto corregido', () => {
    expect(CONSTITUCION_OPERADOR).toContain('ANTES de pedirle el pago')
  })
})

describe('transcripción de audio', () => {
  it('usa gpt-transcribe', () => {
    const parametros = porNombre('Transcribir nota de voz')?.parameters as {
      bodyParameters: { parameters: { name: string; value: string }[] }
    }
    const modelo = parametros.bodyParameters.parameters.find((p) => p.name === 'model')
    expect(modelo?.value).toBe('gpt-transcribe')
  })

  it('whisper-1 no aparece en NINGUNA parte del workflow', () => {
    expect(crudo).not.toContain('whisper-1')
    expect(crudo).not.toContain('whisper')
  })
})

describe('secretos', () => {
  it('todo secreto sale de variables de entorno de la instancia', () => {
    for (const variable of [
      'N8N_WEBHOOK_SECRET',
      'CRM_BASE_URL',
      'WHATSAPP_CLOUD_API_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_VERIFY_TOKEN',
      'CHATWOOT_BASE_URL',
      'CHATWOOT_API_TOKEN',
      'CHATWOOT_ACCOUNT_ID',
    ]) {
      expect(crudo, `${variable} deberia leerse de $env`).toContain(`$env.${variable}`)
    }
  })

  it('no hay ninguna llave literal metida en el JSON', () => {
    expect(crudo).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/) // JWT de Supabase
    expect(crudo).not.toMatch(/sk-[A-Za-z0-9]{20,}/) // clave de OpenAI
    expect(crudo).not.toMatch(/EAA[A-Za-z0-9]{20,}/) // token de Meta
    expect(crudo).not.toContain('supabase.co')
  })
})

describe('despacho y notificación', () => {
  it('el despacho es humano-confirmado y exige el pago del tramo', () => {
    const codigo = String(porNombre('Preparar solicitud de despacho')?.parameters.jsCode)
    expect(codigo).toContain('requiere_accion_humana: true')
    expect(codigo).toContain("pago_recoleccion === 'pagado'")
    expect(codigo).toContain("metodo_transporte_recoleccion === 'app'")
  })

  it('un pedido nuevo avisa al operador por WhatsApp', () => {
    const cuerpo = String(porNombre('Avisar al operador del pedido nuevo')?.parameters.jsonBody)
    expect(cuerpo).toContain('Pedido nuevo')
    expect(cuerpo).toContain('Cola de hoy')
  })
})

describe('resistencia a fallos', () => {
  it('extraer la respuesta nunca tumba el flujo', () => {
    const codigo = String(porNombre('Extraer respuesta')?.parameters.jsCode)
    expect(codigo).toContain('try {')
    expect(codigo).toContain('catch (error)')
    expect(codigo).toContain('requiere_escalar_humano: true')
  })

  it('el error queda registrado, no se traga en silencio', () => {
    expect(porNombre('Registrar error del agente')).toBeDefined()
    expect(String(porNombre('Registrar error del agente')?.parameters.jsonBody)).toContain(
      'error_agente',
    )
  })
})
