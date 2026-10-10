import { describe, expect, it } from 'vitest'
import { porNombre, systemMessage, workflow } from '../util/workflow.ts'

/** Pulido de lo que mostró el tráfico real del 2026-10-05 (conversaciones 26 y 27). */
describe('pulido P2: lo que falló con clientes reales', () => {
  it('F2: la cantidad que el cliente ya dijo se usa y no se vuelve a preguntar', () => {
    expect(systemMessage).toContain('LA CANTIDAD QUE EL CLIENTE YA DIJO SE USA')
    expect(systemMessage).toContain('Volver a preguntar «¿cuántas?»')
  })

  it('F4: fuera de la zona una sola pregunta clara, sin «agendar para que pase por su ropa»', () => {
    expect(systemMessage).toContain('UNA pregunta clara y única')
    expect(systemMessage).toContain('nadie pasa a recoger')
  })

  it('F3: el redactor del seguimiento lee la conversación y no ofrece recoger fuera de zona', () => {
    const redactor = JSON.stringify(porNombre('Redactar Seguimiento')?.parameters)
    expect(redactor).toContain("$('Armar Transcripcion')")
    expect(redactor).toContain('por su zona no recogemos')
    expect(redactor).toContain('ofrécele solo traer y retirar')
    // sin frases de call center en los seguimientos
    expect(redactor).toContain('Nada de relleno de call center')
  })

  it('F5: un aviso sin conversación de Chatwoot no intenta dejar nota (404): solo se marca', () => {
    const c = workflow.connections as unknown as Record<string, { main: { node: string }[][] }>
    expect(c['Ventana Abierta?']?.main[1]?.[0]?.node).toBe('Hay Conversacion?')
    expect(c['Hay Conversacion?']?.main[0]?.[0]?.node).toBe('Nota Aviso Manual')
    expect(c['Hay Conversacion?']?.main[1]?.[0]?.node).toBe('Marcar Aviso Persona')
    expect(JSON.stringify(porNombre('Hay Conversacion?')?.parameters)).toContain(
      'chatwoot_conversation_id',
    )
  })
})
