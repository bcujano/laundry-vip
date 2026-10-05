import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { porNombre, systemMessage, workflow } from '../util/workflow.ts'

/** Persona/agente, protecciones, seguimiento, avisos y las reglas de comportamiento que pidió el dueño. */
describe('agente Laundry VIP: protecciones, seguimiento y reglas del dueño', () => {
  it('si una persona contesta a mano, el agente se calla (etiqueta humano sin pisar las demás)', () => {
    const desdeWebhook = workflow.connections['Chatwoot Webhook']?.main?.[0]?.map((c) => c.node)
    expect(desdeWebhook).toContain('Respondio Persona?')
    expect(workflow.connections['Respondio Persona?']?.main?.[0]?.[0]?.node).toBe(
      'Etiqueta Humano Persona',
    )
    const filtro = JSON.stringify(porNombre('Respondio Persona?')?.parameters)
    expect(filtro).toContain('outgoing')
    expect(filtro).toContain('private')
    // el agente publica como «Agente VIP»: no puede dispararse a sí mismo, pero Byron sí es una persona
    expect(filtro).toContain('Agente VIP')
    expect(filtro).not.toContain('Byron ADMIN')
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

  it('el sector de la recogida se pregunta y viaja al crear el pedido (B4)', () => {
    expect(systemMessage).toContain('`sector`')
    expect(systemMessage).toContain('FUERA_DE_COBERTURA')
    expect(JSON.stringify(porNombre('crear_pedido')?.parameters)).toContain('sector')
  })

  it('el seguimiento retoma leads dentro de las 24 h, sin persona a cargo y sin inventar precios', () => {
    const c = workflow.connections
    const disparador = workflow.nodes.find((n) => n.name === 'Seguimiento cada 5 min')
    expect(JSON.stringify(disparador?.parameters)).toContain('*/5 9-18 * * 1-6')
    const cadena = [
      'Seguimiento cada 5 min',
      'Candidatos Seguimiento',
      'Uno por Candidato',
      'Conversacion Seguimiento',
      'Mensajes Seguimiento',
      'Sin Persona a Cargo?',
      'Armar Transcripcion',
      'Clasificar Conversion',
      'Leer Clasificacion',
      'Sigue Abierto?',
      'Redactar Seguimiento',
      'Armar Seguimiento',
      'Enviar Seguimiento',
      'Guardar Seguimiento en Memoria',
      'Anotar Seguimiento',
    ]
    for (let i = 0; i < cadena.length - 1; i++) {
      expect(c[cadena[i] as string]?.main?.[0]?.[0]?.node).toBe(cadena[i + 1])
    }
    // una persona a cargo (etiqueta humano) frena el seguimiento
    expect(JSON.stringify(porNombre('Sin Persona a Cargo?')?.parameters)).toContain('humano')
    expect(JSON.stringify(porNombre('Sin Persona a Cargo?')?.parameters)).toContain(
      'sin_filtro_persona',
    )
    // ni si alguien del equipo ya le contestó a mano
    expect(JSON.stringify(porNombre('Sin Persona a Cargo?')?.parameters)).toContain('Agente VIP')
    // el modo de Configuración decide si es nota interna o mensaje al cliente
    const armar = String(porNombre('Armar Seguimiento')?.parameters.jsCode)
    expect(armar).toContain("c.modo !== 'activo'")
    // solo valen los montos que ya se le dijeron al cliente
    expect(armar).toContain('ultima_respuesta_agente')
    // el saludo correcto lo pone el código según la hora de Quito
    expect(armar).toContain('Buenas tardes')
    expect(armar).toContain('getUTCHours')
    expect(JSON.stringify(porNombre('Redactar Seguimiento')?.parameters)).toContain('gpt-4.1-mini')
    // los cuatro pasos y la memoria del agente (solo si de verdad se envió)
    expect(JSON.stringify(porNombre('Redactar Seguimiento')?.parameters)).toContain('de 4')
    expect(JSON.stringify(porNombre('Guardar Seguimiento en Memoria')?.parameters)).toContain(
      "'activo'",
    )
    expect(JSON.stringify(porNombre('Anotar Seguimiento')?.parameters)).toContain('paso')
  })

  it('antes de insistir, lee la conversación: si ya compró entra al CRM y no se le insiste', () => {
    const c = workflow.connections
    // abierto → sigue el seguimiento; cualquier otro estado → se registra y se avisa
    expect(c['Sigue Abierto?']?.main?.[0]?.[0]?.node).toBe('Redactar Seguimiento')
    expect(c['Sigue Abierto?']?.main?.[1]?.[0]?.node).toBe('Registrar Conversion')
    expect(c['Registrar Conversion']?.main?.[0]?.[0]?.node).toBe('Nota Conversion')
    const clasificar = JSON.stringify(porNombre('Clasificar Conversion')?.parameters)
    for (const estado of ['vendido', 'agendado', 'rechazado', 'abierto']) {
      expect(clasificar).toContain(estado)
    }
    // ante la duda, abierto: nunca se deja de atender por una clasificación incierta
    expect(String(porNombre('Leer Clasificacion')?.parameters.jsCode)).toContain(
      "estado: 'abierto'",
    )
    expect(JSON.stringify(porNombre('Registrar Conversion')?.parameters)).toContain(
      'registrar_conversion',
    )
    // el pedido no se inventa desde un chat: se avisa que falta
    expect(JSON.stringify(porNombre('Nota Conversion')?.parameters)).toContain(
      'FALTA crear su pedido',
    )
  })

  it('el aviso de discrepancia: dentro de las 24 h se manda, fuera queda nota para una persona (2026-09-30)', () => {
    const c = workflow.connections
    expect(c['Avisos Pendientes']?.main?.[0]?.[0]?.node).toBe('Uno por Aviso')
    expect(c['Ventana Abierta?']?.main?.[0]?.[0]?.node).toBe('Enviar Aviso al Cliente')
    expect(c['Ventana Abierta?']?.main?.[1]?.[0]?.node).toBe('Nota Aviso Manual')
    // el texto viene del CRM tal cual: el flujo no lo redacta ni le pone cifras
    const enviar = JSON.stringify(porNombre('Enviar Aviso al Cliente')?.parameters)
    expect(enviar).toContain('.texto')
    expect(enviar).not.toContain('openai')
    // fuera de la ventana no hay texto libre: es nota privada
    expect(JSON.stringify(porNombre('Nota Aviso Manual')?.parameters)).toContain('private: true')
    expect(JSON.stringify(porNombre('Marcar Aviso Persona')?.parameters)).toContain(
      'requiere_persona',
    )
  })

  it('si el cliente responde a un aviso de diferencia, el agente no discute montos y escala (2026-09-30)', () => {
    expect(systemMessage).toContain('AVISOS DE DIFERENCIA')
    expect(systemMessage).toContain('NO')
    expect(systemMessage).toContain('no das\n   cuentas de pago')
  })

  it('usa el saludo de la casa que define el dueño en Configuración (2026-09-30)', () => {
    expect(systemMessage).toContain('negocio?.saludo')
    expect(systemMessage).toContain('SALUDO DE LA CASA')
  })

  it('ya no pregunta cuántas fundas: la recogida y la entrega siempre van en auto (2026-10-01)', () => {
    expect(porNombre('calcular_vehiculo')).toBeUndefined()
    expect(systemMessage).not.toContain('calcular_vehiculo')
    expect(systemMessage).toContain('SIEMPRE van en auto')
    expect(systemMessage).toContain('NUNCA\n   preguntes cuántas fundas')
    // el pedido tampoco lleva el número de fundas
    expect(JSON.stringify(porNombre('crear_pedido')?.parameters)).not.toContain('numero_fundas')
    // al peso: siempre un estimado, y las libras reales se confirman en planta
    expect(systemMessage).toContain('se pesan en\n     planta')
  })

  it('verifica la cobertura por dentro y nunca le habla de kilómetros al cliente (2026-10-01)', () => {
    expect(porNombre('verificar_cobertura')).toBeDefined()
    expect(systemMessage).toContain('verificar_cobertura')
    expect(systemMessage).toContain('NUNCA menciones kilómetros')
    // el prompt no lleva el radio escrito
    expect(systemMessage).not.toMatch(/\d+[,.]?\d*\s*km/i)
    // la ventana de recolección ya no entrega el radio al modelo
    expect(String(porNombre('obtener_proxima_ventana')?.parameters.toolDescription)).not.toContain(
      'hasta donde',
    )
  })

  it('responde solo lo necesario, sin soltar horario ni plazo que no preguntaron (2026-10-01)', () => {
    expect(systemMessage).toContain('DIRECTO, SIN RELLENO')
    // precio y plazo van juntos, apenas dice qué quiere lavar
    expect(systemMessage).toContain('Dilo junto con el')
    // la regla es una forma de actuar, no una plantilla que se copia
    expect(systemMessage).toContain('NO una plantilla')
  })

  it('el primer seguimiento es a los 5 minutos y avisa a la dueña con un resumen (2026-10-05)', () => {
    const c = workflow.connections
    const cadena = [
      'Anotar Seguimiento',
      'Es Primer Aviso?',
      'Resumir Para la Duena',
      'Nota Resumen',
      'Admins Para Aviso',
      'Uno por Admin',
      'Duena en Ventana?',
      'Avisar a la Duena',
    ]
    for (let i = 0; i < cadena.length - 1; i++) {
      expect(c[cadena[i] as string]?.main?.[0]?.[0]?.node).toBe(cadena[i + 1])
    }
    // solo con el primer seguimiento y solo si de verdad se le escribió al cliente
    const cond = JSON.stringify(porNombre('Es Primer Aviso?')?.parameters)
    expect(cond).toContain('paso === 1')
    expect(cond).toContain("modo === 'activo'")
    // la nota interna del chat queda siempre; el WhatsApp solo si le cabe texto libre
    expect(JSON.stringify(porNombre('Nota Resumen')?.parameters)).toContain('private: true')
    expect(JSON.stringify(porNombre('Duena en Ventana?')?.parameters)).toContain(
      'dentro_de_ventana',
    )
    expect(JSON.stringify(porNombre('Avisar a la Duena')?.parameters)).toContain(
      'graph.facebook.com',
    )
    // el resumen sale de lo que se habló, no de lo que el modelo imagine
    expect(JSON.stringify(porNombre('Resumir Para la Duena')?.parameters)).toContain(
      'No inventes datos',
    )
  })

  it('el catálogo en imagen sale como adjunto de Chatwoot, solo en el primer contacto', () => {
    const descarga = JSON.stringify(porNombre('Descargar Catalogo')?.parameters)
    // la imagen es la del dueño, servida por el CRM: nada la genera ni es un enlace pegado al chat
    expect(descarga).toContain('https://laundry-vip.vercel.app/catalogo.png')
    expect(JSON.stringify(workflow.connections)).not.toContain('/api/catalogo')
    const envio = JSON.stringify(porNombre('Enviar Catalogo')?.parameters)
    expect(envio).toContain('attachments[]')
    expect(envio).not.toContain('"content"')
    expect(JSON.stringify(porNombre('Primer Contacto?')?.parameters)).toContain(
      'previos.length === 0',
    )
    expect(systemMessage).toContain('LA LISTA DE PRECIOS LLEGA SOLA')
    // cadena conectada tras la respuesta al cliente
    const c = workflow.connections as unknown as Record<string, { main: { node: string }[][] }>
    expect(c['Enviar Respuesta Chatwoot']?.main[0]?.map((x) => x.node)).toContain(
      'Primer Contacto?',
    )
    expect(c['Primer Contacto?']?.main[0]?.[0]?.node).toBe('Descargar Catalogo')
    expect(c['Descargar Catalogo']?.main[0]?.[0]?.node).toBe('Nombrar Catalogo')
    expect(c['Nombrar Catalogo']?.main[0]?.[0]?.node).toBe('Enviar Catalogo')
  })

  it('la imagen del catálogo existe en el CRM y es un PNG', () => {
    const png = readFileSync('public/catalogo.png')
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.length).toBeLessThan(5 * 1024 * 1024) // límite de WhatsApp para imágenes
  })
})
