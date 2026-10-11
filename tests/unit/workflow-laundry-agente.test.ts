import { describe, expect, it } from 'vitest'
import { crudo, porNombre, prompt, systemMessage, workflow } from '../util/workflow.ts'

/** El agente clonado del 321: sin rastros de 321, credenciales propias y las reglas duras del prompt. */
describe('agente Laundry VIP (clon del 321)', () => {
  it('no arrastra nada de 321', () => {
    expect(crudo).not.toContain('accounts/1/')
    expect(crudo).not.toContain('937260122807094')
    expect(crudo).not.toContain('chatwoot-inmobiliaria')
    expect(crudo).not.toMatch(/321 (INMO|Soluciones)|Arqui|Inmo/i)
    expect(crudo).not.toMatch(/googleSheets|googleCalendar|gmail/i)
  })

  it('solo usa credenciales de Laundry VIP, salvo OpenAI y Gemini (de AIUDA, no de 321) que se reusan', () => {
    const nombres = new Set(
      workflow.nodes.flatMap((n) => Object.values(n.credentials ?? {}).map((c) => c.name)),
    )
    expect([...nombres].sort()).toEqual(
      [
        'CRM Laundry VIP Webhook',
        'Chatwoot Laundry VIP API',
        'Gemini Aiuda',
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

  it('cuelga las siete tools del CRM y la calculadora del agente', () => {
    const tools = Object.entries(workflow.connections)
      .filter(([, tipos]) => tipos.ai_tool?.[0]?.[0]?.node === 'Agente Laundry VIP')
      .map(([nombre]) => nombre)
      .sort()
    expect(tools).toEqual(
      [
        'Calculator',
        'consultar_estado_pedido',
        'consultar_politica',
        'cotizar_prendas',
        'crear_pedido',
        'find_or_create_client',
        'obtener_proxima_ventana',
        'verificar_cobertura',
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
    expect(systemMessage).toContain('Confirmar un pago, dar cuentas bancarias o corregir un monto')
    expect(systemMessage).toContain('Contar prendas en una foto para cotizar')
    expect(systemMessage).toContain('Prometer que una mancha sale')
    expect(systemMessage).toContain('Borrar, anular, cancelar ni modificar nada')
    expect(systemMessage).toContain('requiere_metodo')
    expect(systemMessage).toContain('sí explícito')
    expect(systemMessage).toContain('SOLO se escribe si salió de una herramienta')
  })

  it('suena a persona del local, no a robot (2026-09-24)', () => {
    // El saludo se varía; nunca sale de una plantilla fija.
    expect(systemMessage).toContain('Varía el saludo y los cierres')
    // Jamás se anuncia como asistente virtual: eso asusta al cliente.
    expect(systemMessage).toContain('No te presentes como asistente ni digas qué eres')
    expect(systemMessage).not.toContain('Soy la asistente virtual')
    expect(systemMessage.split('\n')[0]).not.toContain('asistente virtual')
    // Pero si se lo preguntan de frente, no miente.
    expect(systemMessage).toContain('NO mientas')
    // Lee el tono del cliente y se ajusta.
    expect(systemMessage).toContain('Lee el tono del cliente y ajústate')
    // Y tiene prohibido el repertorio de call center.
    expect(systemMessage).toContain('estoy para servirle')
    expect(systemMessage).toContain('quedo atenta a su respuesta')
  })

  it('nunca le niega un servicio al cliente y el aviso de datos va al cierre', () => {
    // Dijo «no ofrecemos tinturado» teniendo tinturado en el catálogo.
    expect(systemMessage).toContain('Decir que NO se ofrece un servicio')
    expect(systemMessage).toContain('NUNCA digas que no se hace')
    expect(systemMessage).toContain('sugerencias')
    expect(systemMessage).toContain('una sola vez, al pedir los datos para cerrar, no en el saludo')
  })

  it('trae las reglas que pidió el dueño el 2026-09-23', () => {
    // Nombre y aviso de datos.
    expect(systemMessage).toContain('Protección de Datos Personales')
    expect(systemMessage).toContain('datos_lead.nombre')
    expect(systemMessage).toContain('NUNCA inventes el nombre')
    // Siempre un estimado en dólares.
    expect(systemMessage).toContain('Siempre es un ESTIMADO en dólares')
    // Peso en libras y solo para ropa de diario; las cortinas siguen por kilo.
    expect(systemMessage).toContain('va al peso en libras')
    expect(systemMessage).toContain('cortinas por kilo')
    // El lapso de entrega y la tarifa salen de la herramienta, no del prompt.
    expect(systemMessage).toContain('plazo_entrega')
    expect(systemMessage).toContain('tarifa_recoleccion_entrega')
    expect(systemMessage).not.toMatch(/48 a 72 horas.{0,40}\$/)
    // Ni combos ni carta: esto es una lavandería.
    expect(systemMessage).toContain('Nada de «combo» ni «a la carta»')
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

  it('la dirección, el fijo y el mapa salen de Configuración, no del prompt (B3)', () => {
    expect(systemMessage).not.toContain('Pedro Barrios')
    expect(systemMessage).not.toContain('281-0815')
    expect(systemMessage).not.toContain('maps.google.com')
    expect(systemMessage).toContain('negocio?.direccion')
    expect(systemMessage).toContain('negocio?.telefono')
    expect(systemMessage).toContain('negocio?.enlace_mapa')
  })

  it('no hay ninguna llave literal', () => {
    expect(crudo).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/)
    expect(crudo).not.toMatch(/EAA[A-Za-z0-9]{20,}/)
    expect(crudo).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\./)
  })
})
