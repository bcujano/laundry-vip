import { describe, expect, it } from 'vitest'
import { porNombre } from '../util/workflow.ts'

/**
 * Ejecuta de verdad el código de «Extraer JSON» (el que corre en n8n) con datos simulados:
 * el modelo no puede decir un monto o un plazo que no salió de una herramienta de precios ni se
 * le dijo ya al cliente. Caso real: Gemini flash-lite respondió «$31,50» y «48 horas» sin llamar
 * a ninguna herramienta (2026-10-09).
 */
type Paso = { action: { tool: string }; observation: string }

function correr(opts: {
  respuesta: string
  pasos?: Paso[]
  previos?: string[]
  operador?: boolean
}) {
  const codigo = String(porNombre('Extraer JSON')?.parameters.jsCode)
  const salida = {
    output: JSON.stringify({
      respuesta_lead: opts.respuesta,
      tool_consultada: 'cotizar_prendas',
      escalar_humano: false,
      metadata: {},
    }),
    intermediateSteps: opts.pasos ?? [],
  }
  const nodos: Record<string, unknown> = {
    'WhatsApp Inicio': {
      first: () => ({
        json: {
          contacts: [{ wa_id: '593220000000', profile: { name: 'Prueba' } }],
          _chatwoot_conversation_id: 1,
        },
      }),
    },
    'Verificar Operador': {
      first: () => ({ json: { data: { es_operador: opts.operador === true } } }),
    },
    'Obtener Ultimos Mensajes': {
      first: () => ({
        json: { payload: (opts.previos ?? []).map((c) => ({ message_type: 1, content: c })) },
      }),
    },
  }
  const $ = (n: string) => {
    const nodo = nodos[n] as { first: () => unknown } | undefined
    if (!nodo) throw new Error(`sin nodo ${n}`)
    return { ...nodo, item: nodo.first() as object }
  }
  const ejecutar = new Function('$input', '$', `${codigo}`)
  const resultado = ejecutar({ first: () => ({ json: salida }) }, $) as {
    json: Record<string, unknown>
  }[]
  return resultado[0]?.json as {
    texto_limpio?: string
    escalar_humano?: string
    valor_sin_herramienta?: boolean
  }
}

const COTIZACION: Paso[] = [
  {
    action: { tool: 'cotizar_prendas' },
    observation: '{"ok":true,"data":{"resumen":{"subtotal":29.5,"plazo_entrega":"72 horas"}}}',
  },
]

describe('guardia de valores sin herramienta (Extraer JSON)', () => {
  it('un monto y un plazo sin haber llamado a ninguna herramienta se reemplazan y se escala', () => {
    const r = correr({ respuesta: 'El valor estimado es de $31,50. El plazo es de 48 horas.' })
    expect(r.valor_sin_herramienta).toBe(true)
    expect(r.texto_limpio).not.toContain('31,50')
    expect(r.texto_limpio).toContain('persona de nuestro equipo')
    expect(r.escalar_humano).toBe('si')
  })

  it('si la herramienta de precios corrió en este turno, la respuesta pasa tal cual', () => {
    const r = correr({ respuesta: 'Serían $29,50 y se entregan en 72 horas.', pasos: COTIZACION })
    expect(r.valor_sin_herramienta).toBe(false)
    expect(r.texto_limpio).toContain('$29,50')
  })

  it('repetir un monto que ya se le dijo al cliente no cuenta como inventado', () => {
    const r = correr({
      respuesta: 'Como le comenté, son $22,50 por los ternos.',
      previos: ['Los 3 ternos salen en $22,50 y se entregan en 72 horas. ¿Me regala su nombre?'],
    })
    expect(r.valor_sin_herramienta).toBe(false)
  })

  it('un monto distinto al que se dijo antes sí se bloquea', () => {
    const r = correr({ respuesta: 'Serían $25,00.', previos: ['Salen en $22,50.'] })
    expect(r.valor_sin_herramienta).toBe(true)
  })

  it('una respuesta sin montos ni plazos no se toca', () => {
    const r = correr({ respuesta: '¿Me regala su nombre, por favor?' })
    expect(r.valor_sin_herramienta).toBe(false)
    expect(r.escalar_humano).toBe('')
  })

  it('el agente de planta y de la dueña no se ve afectado', () => {
    const r = correr({ respuesta: 'Total $10,00', operador: true })
    expect(r.valor_sin_herramienta).toBe(false)
  })
})
