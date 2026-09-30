#!/usr/bin/env node
/**
 * Comprueba que los prompts que quedaron en n8n son IDÉNTICOS, carácter por
 * carácter, a los de este repo. Transcribir un prompt a mano en la llamada MCP
 * se come tildes (pasó con «propón»), y un prompt distinto del que crees que
 * está publicado es un bug invisible.
 *
 * Uso (la forma más simple, sin elegir versiones):
 *   1. Pide al MCP de n8n `get_workflow_details` (workflowId Bleb55WBKPfBdxVg,
 *      detailLevel full). El resultado es largo: el MCP lo guarda en un
 *      archivo y te da la ruta.
 *   2. node n8n/verificar-prompts.cjs <esa-ruta>
 *
 * También acepta la salida de `get_workflow_versions_diff`; en ese caso solo
 * revisa los agentes que cambiaron entre las dos versiones.
 *
 * Sale con código 1 si algún prompt no coincide, y muestra las líneas que
 * difieren. Con código 2 si el archivo no trae ningún prompt que revisar.
 */
const fs = require('node:fs')
const path = require('node:path')

const ARCHIVOS = {
  'Agente Laundry VIP': 'prompt-agente-laundry.md',
  'Agente Operador': 'prompt-operador-laundry.md',
}

const ruta = process.argv[2]
if (!ruta) {
  console.error('Uso: node n8n/verificar-prompts.cjs <archivo-del-diff.json>')
  process.exit(2)
}

const crudo = JSON.parse(fs.readFileSync(ruta, 'utf8'))

/** Una lista de { name, nuevo } sea cual sea el formato del archivo. */
function promptsPublicados(datos) {
  // Formato diff: nodesModified[].changes.parameters.options.systemMessage.__new
  if (Array.isArray(datos.nodesModified)) {
    return datos.nodesModified.map((nodo) => ({
      name: nodo.name,
      nuevo: nodo.changes?.parameters?.options?.systemMessage?.__new,
    }))
  }
  // Formato workflow completo: workflow.nodes[] o nodes[]
  const nodos = datos.workflow?.nodes ?? datos.nodes ?? []
  return nodos.map((nodo) => ({
    name: nodo.name,
    nuevo: nodo.parameters?.options?.systemMessage,
  }))
}

let fallos = 0
let revisados = 0

for (const { name, nuevo } of promptsPublicados(crudo)) {
  const archivo = ARCHIVOS[name]
  if (!archivo || typeof nuevo !== 'string') continue
  const nodo = { name }

  revisados++
  const local = fs.readFileSync(path.join(__dirname, archivo), 'utf8').replace(/\n+$/, '')
  if (nuevo === local) {
    console.log(`OK   ${nodo.name}: idéntico a ${archivo} (${nuevo.length} caracteres)`)
    continue
  }

  fallos++
  console.log(`FALLA ${nodo.name}: difiere de ${archivo}`)
  const a = local.split('\n')
  const b = nuevo.split('\n')
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.log(
        `  línea ${i + 1}\n    repo: ${a[i] ?? '(falta)'}\n    n8n : ${b[i] ?? '(falta)'}`,
      )
    }
  }
}

if (revisados === 0) {
  console.log('El archivo no trae ningún prompt de los dos agentes: no hay nada que comparar.')
  process.exit(2)
}
process.exit(fallos > 0 ? 1 : 0)
