import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { crudo, type Nodo, porNombre, RAIZ, workflow } from '../util/workflow.ts'

/** Registro en el CRM, modo operador, guardia anti-alucinación y niveles. */
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
