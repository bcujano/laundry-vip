import { describe, expect, it } from 'vitest'
import { porNombre, workflow } from '../util/workflow.ts'

type Conexiones = Record<string, { main: { node: string }[][] }>
const c = workflow.connections as unknown as Conexiones

describe('aviso inmediato al equipo (workflow de n8n)', () => {
  it('al escalar se crea el aviso y cuando una persona escribe se da por atendido', () => {
    expect(c['Nota Escalamiento']?.main[0]?.[0]?.node).toBe('Crear Aviso Equipo')
    const personas = c['Respondio Persona?']?.main[0]?.map((x) => x.node)
    // no se rompe lo que ya hacía: sigue poniendo la etiqueta «humano»
    expect(personas).toEqual(
      expect.arrayContaining(['Etiqueta Humano Persona', 'Atender Avisos Equipo']),
    )
    const crear = JSON.stringify(porNombre('Crear Aviso Equipo')?.parameters)
    expect(crear).toContain('crear_aviso_equipo')
    // un aviso por caso: la clave es la conversación, no el mensaje
    expect(crear).toContain("caso: 'chat-'")
  })

  it('el envío corre todos los días a cualquier hora, no solo en horario del local', () => {
    const cron = JSON.stringify(porNombre('Avisos Equipo cada 3 min')?.parameters)
    expect(cron).toContain('*/3 * * * *')
    expect(cron).not.toMatch(/9-1[89]|1-6/)
  })

  it('con ventana abierta va texto libre y sin ella la plantilla aprobada; luego se marca', () => {
    const rama = c['Destinatario en Ventana?']?.main
    expect(rama?.[0]?.[0]?.node).toBe('Aviso Equipo Texto')
    expect(rama?.[1]?.[0]?.node).toBe('Aviso Equipo Plantilla')
    expect(JSON.stringify(porNombre('Aviso Equipo Plantilla')?.parameters)).toContain(
      'aviso_equipo',
    )
    const desdePendientes = c['Avisos Equipo Pendientes']?.main[0]?.map((x) => x.node)
    expect(desdePendientes).toEqual(['Uno por Destinatario', 'Uno por Aviso Equipo'])
    expect(c['Uno por Aviso Equipo']?.main[0]?.[0]?.node).toBe('Marcar Aviso Equipo')
  })

  it('el texto del aviso y el reintento los decide el servidor, no el flujo ni el modelo', () => {
    const texto = JSON.stringify([
      porNombre('Aviso Equipo Texto')?.parameters,
      porNombre('Uno por Destinatario')?.parameters,
    ])
    expect(texto).toContain('$json.texto')
    expect(JSON.stringify(porNombre('Uno por Aviso Equipo')?.parameters)).toContain('reintentado')
    for (const nombre of ['Aviso Equipo Texto', 'Aviso Equipo Plantilla', 'Crear Aviso Equipo']) {
      expect(JSON.stringify(porNombre(nombre)?.parameters)).not.toContain('openai')
    }
  })

  it('un fallo de Meta o del CRM no detiene el flujo', () => {
    for (const nombre of [
      'Crear Aviso Equipo',
      'Atender Avisos Equipo',
      'Avisos Equipo Pendientes',
      'Aviso Equipo Texto',
      'Aviso Equipo Plantilla',
      'Marcar Aviso Equipo',
    ]) {
      const nodo = porNombre(nombre) as { onError?: string } | undefined
      expect(nodo?.onError, nombre).toBe('continueRegularOutput')
    }
  })
})
