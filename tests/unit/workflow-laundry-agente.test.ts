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

  it('si una persona contesta a mano, el agente se calla (etiqueta humano sin pisar las demás)', () => {
    const desdeWebhook = workflow.connections['Chatwoot Webhook']?.main?.[0]?.map((c) => c.node)
    expect(desdeWebhook).toContain('Respondio Persona?')
    expect(workflow.connections['Respondio Persona?']?.main?.[0]?.[0]?.node).toBe(
      'Etiqueta Humano Persona',
    )
    const filtro = JSON.stringify(porNombre('Respondio Persona?')?.parameters)
    expect(filtro).toContain('outgoing')
    expect(filtro).toContain('private')
    // el agente publica como «Byron ADMIN»: no puede dispararse a sí mismo
    expect(filtro).toContain('Byron ADMIN')
    const etiqueta = JSON.stringify(porNombre('Etiqueta Humano Persona')?.parameters)
    expect(etiqueta).toContain('humano')
    expect(etiqueta).toContain('conversation?.labels')
  })

  it('cada mensaje pasa por el tope diario y la deduplicación del CRM antes de llegar al agente (B2)', () => {
    const c = workflow.connections
    expect(c['Es Ultimo Mensaje?']?.main?.[0]?.map((x) => x.node)).toEqual(['Registrar Entrante'])
    expect(c['Registrar Entrante']?.main?.[0]?.[0]?.node).toBe('Puede Continuar?')
    expect(c['Puede Continuar?']?.main?.[0]?.[0]?.node).toBe('Combinar Textos')
    expect(c['Puede Continuar?']?.main?.[1]?.[0]?.node).toBe('Motivo de Corte')
    const entrante = String(porNombre('Registrar Entrante')?.parameters.jsonBody)
    expect(entrante).toContain('registrar_evento_entrante')
    // el teléfono va en el sobre (no en parametros): es lo que lee el tope
    expect(entrante).toMatch(/telefono: /)
    expect(entrante).toContain('dedupe_key')
    const condicion = JSON.stringify(porNombre('Puede Continuar?')?.parameters)
    expect(condicion).toContain('ya_procesado')
    expect(condicion).toContain('costo_excedido')
    expect(condicion).toContain('LIMITE_DIARIO_ALCANZADO')
  })

  it('el gasto de OpenAI de cada turno se reporta al CRM, sin contar un mensaje más (B2)', () => {
    const destinos = workflow.connections['Extraer JSON']?.main?.[0]?.map((x) => x.node)
    expect(destinos).toContain('Estimar Uso')
    expect(workflow.connections['Estimar Uso']?.main?.[0]?.[0]?.node).toBe('Registrar Uso')
    const uso = String(porNombre('Registrar Uso')?.parameters.jsonBody)
    expect(uso).toContain('uso_openai')
    // sin teléfono en el sobre: si no, el reporte gastaría cuota de mensajes
    expect(uso).not.toContain('telefono')
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

  it('suena a persona del local, no a robot (2026-09-24)', () => {
    // El saludo se escribe cada vez; nunca sale de una plantilla fija.
    expect(systemMessage).toContain('EL SALUDO NUNCA ES EL MISMO')
    expect(systemMessage).toContain('VARÍA SIEMPRE')
    // Jamás se anuncia como asistente virtual: eso asusta al cliente.
    expect(systemMessage).toContain('NUNCA DIGAS QUÉ ERES')
    expect(systemMessage).not.toContain('Soy la asistente virtual')
    expect(systemMessage.split('\n')[0]).not.toContain('asistente virtual')
    // Pero si se lo preguntan de frente, no miente.
    expect(systemMessage).toContain('NO\n   MIENTA')
    // Lee el tono del cliente y se ajusta.
    expect(systemMessage).toContain('LEE EL TONO Y AJÚSTATE')
    // Y tiene prohibido el repertorio de call center.
    expect(systemMessage).toContain('Estoy para servirle')
    expect(systemMessage).toContain('quedo atenta a su pronta')
  })

  it('nunca le niega un servicio al cliente y el aviso de datos va al cierre', () => {
    // Dijo «no ofrecemos tinturado» teniendo tinturado en el catálogo.
    expect(systemMessage).toContain('JAMÁS DIGAS QUE NO SE OFRECE UN SERVICIO')
    expect(systemMessage).toContain('sugerencias')
    expect(systemMessage).toContain('EL AVISO DE DATOS NO VA EN EL SALUDO')
  })

  it('trae las reglas que pidió el dueño el 2026-09-23', () => {
    // Saludo, nombre y aviso de datos en el primer mensaje.
    expect(systemMessage).toContain('PRIMER MENSAJE Y NOMBRE DEL CLIENTE')
    expect(systemMessage).toContain('Protección de Datos Personales')
    expect(systemMessage).toContain('datos_lead.nombre')
    // Siempre un estimado, nunca solo «se confirma en planta».
    expect(systemMessage).toContain('SIEMPRE DA UN ESTIMADO EN DÓLARES')
    // Peso en libras y solo para ropa suelta; las cortinas siguen por kilo.
    expect(systemMessage).toContain('EL PESO SE HABLA EN LIBRAS')
    expect(systemMessage).toContain('las cortinas se cobran\n   POR KILO')
    expect(systemMessage).toContain('POR PESO (por libra)')
    // El lapso de entrega y la tarifa salen del CRM, no del prompt.
    expect(systemMessage).toContain('horas_entrega_min')
    expect(systemMessage).toContain('tarifa_recoleccion_entrega')
    expect(systemMessage).not.toMatch(/48 a 72 horas.{0,40}\$/)
    // Ni combos ni carta: esto es una lavandería.
    expect(systemMessage).toContain('no un restaurante')
    expect(systemMessage).toContain('Jamás uses esas dos palabras')
    // El método lo manda el catálogo.
    expect(systemMessage).toContain('metodo_unico')
    expect(systemMessage).toContain('advertencia')
  })

  it('el nombre del negocio lo lee del CRM, no lo lleva escrito', () => {
    // Si el dueño lo cambia en Configuración, el agente se presenta distinto.
    expect(systemMessage).toContain("$('Verificar Operador')")
    expect(systemMessage).toContain('negocio?.nombre')
    // El nombre viejo no puede quedar como texto fijo en la presentación.
    expect(systemMessage.split('\n')[0]).not.toContain('Lavandería VIP')
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
        'avanzar_estado',
        'buscar_pedidos',
        'consulta_admin',
        'consultar_pedido',
        'cotizar_prendas_operador',
        'generar_reporte',
        'registrar_cliente_presencial',
        'registrar_conteo',
      ].sort(),
    )
    expect(String(porNombre('Memory Operador')?.parameters.sessionKey)).toContain('operador_')
    const opciones = porNombre('Agente Operador')?.parameters.options as { systemMessage: string }
    expect(opciones.systemMessage).toBe(promptOperador.replace(/\n$/, ''))
    expect(opciones.systemMessage).toContain('NUNCA borra')
  })

  it('a la dueña la trata de usted y la acompaña con datos, no con opiniones', () => {
    // Al admin (la dueña) no se le habla como al operador de planta.
    expect(promptOperador).toContain('SECCIÓN 1: TONO (DEPENDE DEL NIVEL)')
    expect(promptOperador).toContain('DUEÑA DEL NEGOCIO')
    expect(promptOperador).toContain('Trato de USTED y por su nombre')
    expect(promptOperador).toContain('ACOMPAÑAR A LA DUEÑA')
    expect(promptOperador).toContain('RESPONDE CON DATOS, NUNCA CON OPINIÓN SUELTA')
    expect(promptOperador).toContain('SIEMPRE OFRECE EL SIGUIENTE PASO ÚTIL')
    expect(promptOperador).toContain('No inventes tendencias')
    // Y sabe qué preguntarle al CRM para responder «¿cómo vamos?».
    expect(promptOperador).toContain('como_vamos')
    expect(String(porNombre('consulta_admin')?.parameters.jsonBody)).toContain('como_vamos')
  })

  it('las acciones de operador llevan el teléfono del que escribe, no uno que invente el modelo', () => {
    for (const nombre of [
      'registrar_cliente_presencial',
      'actualizar_registro',
      'avanzar_estado',
      'registrar_conteo',
      'consulta_admin',
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

describe('niveles y resumen diario', () => {
  it('ninguna herramienta del agente mueve dinero', () => {
    for (const nombre of ['confirmar_pago', 'corregir_cotizacion']) {
      expect(porNombre(nombre), nombre).toBeUndefined()
    }
    expect(crudo).not.toContain('"accion":"confirmar_pago"')
    expect(crudo).not.toContain('"accion":"corregir_cotizacion"')
  })

  it('el agente de planta conoce el nivel de quien escribe', () => {
    const opciones = porNombre('Agente Operador')?.parameters.options as { systemMessage: string }
    expect(opciones.systemMessage).toContain("$('Verificar Operador').first().json.data.nivel")
  })

  it('el resumen de las 8:00 va como texto libre dentro de las 24 h y como plantilla fuera', () => {
    const disparador = workflow.nodes.find((n) => n.name === 'Resumen 8:00') as Nodo & {
      disabled?: boolean
    }
    expect(disparador.disabled).toBeFalsy()
    expect(
      (workflow.connections['¿Dentro de 24 h?']?.main ?? []).map((s) => s.map((c) => c.node)),
    ).toEqual([['Enviar Resumen WhatsApp'], ['Enviar Resumen Plantilla']])

    const texto = String(porNombre('Enviar Resumen WhatsApp')?.parameters.jsonBody)
    expect(texto).toContain('type: "text"')
    expect(String(porNombre('Enviar Resumen Plantilla')?.parameters.jsonBody)).toContain(
      'resumen_diario_admin',
    )
    for (const nombre of ['Enviar Resumen WhatsApp', 'Enviar Resumen Plantilla']) {
      expect(String(porNombre(nombre)?.parameters.url)).toContain('1220603671147410')
    }
  })
})
