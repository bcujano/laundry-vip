// Comprueba que los nodos de n8n conservan su manejo de errores («continuar si falla»).
//
// Por qué existe: al crear nodos por MCP (`addNode`) se pierde `onError`, y hay que volver a
// fijarlo con `setNodeSettings`. Sin eso, un 404 de Chatwoot o una caída del CRM detiene todo el
// flujo (le pasó a `Nota Aviso Manual` el 2026-10-01). Se corre tras CADA publicación por MCP.
//
// Uso:  node n8n/verificar-errores.cjs <ruta del JSON de get_workflow_details>
// Salida 0 si todo coincide; 1 y la lista de operaciones `setNodeSettings` que faltan si no.
const fs = require('node:fs')
const path = require('node:path')

const ruta = process.argv[2]
if (!ruta) {
  console.error('Uso: node n8n/verificar-errores.cjs <archivo get_workflow_details>')
  process.exit(2)
}
const vivo = JSON.parse(fs.readFileSync(ruta, 'utf8')).workflow
const repo = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'workflows', 'laundry-vip-agente.json'), 'utf8'),
)

const manejo = (n) => n.onError || (n.continueOnFail ? 'continueRegularOutput' : null)
const faltan = []
for (const nodo of repo.nodes) {
  const enVivo = vivo.nodes.find((n) => n.name === nodo.name)
  if (!enVivo) continue
  const quiere = manejo(nodo)
  if (quiere && quiere !== manejo(enVivo)) faltan.push({ nodo: nodo.name, quiere })
}

if (faltan.length === 0) {
  console.log('OK   todos los nodos conservan su manejo de errores')
  process.exit(0)
}
console.log(`FALLA ${faltan.length} nodo(s) sin su manejo de errores en n8n:`)
for (const f of faltan) console.log(`  - ${f.nodo} (debe ser ${f.quiere})`)
console.log('\nOperaciones para update_workflow:')
console.log(
  JSON.stringify(
    faltan.map((f) => ({
      type: 'setNodeSettings',
      nodeName: f.nodo,
      settings: { onError: f.quiere },
    })),
  ),
)
process.exit(1)
