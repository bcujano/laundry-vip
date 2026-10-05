import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * El agente clonado del 321. Se prueba que no arrastre nada de 321, que use
 * sus propias credenciales y que las reglas duras estén en la constitución.
 */
export const RAIZ = resolve(import.meta.dirname, '../..')
export const crudo = readFileSync(resolve(RAIZ, 'n8n/workflows/laundry-vip-agente.json'), 'utf8')
export const prompt = readFileSync(resolve(RAIZ, 'n8n/prompt-agente-laundry.md'), 'utf8')

export type Nodo = {
  name: string
  type: string
  parameters: Record<string, unknown>
  credentials?: Record<string, { id?: string; name: string }>
}
export const workflow = JSON.parse(crudo) as {
  nodes: Nodo[]
  connections: Record<string, Record<string, { node: string }[][]>>
  settings: Record<string, unknown>
  active: boolean
}
export const porNombre = (nombre: string) => workflow.nodes.find((n) => n.name === nombre)
export const agente = porNombre('Agente Laundry VIP')
export const systemMessage = String(
  (agente?.parameters.options as { systemMessage?: string })?.systemMessage,
)
