# El agente de WhatsApp en n8n

Workflow vivo: **`Bleb55WBKPfBdxVg`** «iAgente Laundry VIP» en
`https://primary-production-ed243.up.railway.app`. Su espejo en el repo es
[`workflows/laundry-vip-agente.json`](workflows/laundry-vip-agente.json).

Nace del agente de 321 («iAgente 321 INMO V2»), clonado y recortado: se conservó
su fontanería (debounce que relee Chatwoot, audio, imagen, memoria, parser
robusto) y se cambió lo específico del negocio. El estado completo y el flujo
nodo por nodo están en [`../docs/CONTINUIDAD.md`](../docs/CONTINUIDAD.md).

## Qué hay aquí

| Ruta | Qué es |
|---|---|
| `workflows/laundry-vip-agente.json` | El workflow generado (85 nodos) |
| `prompt-agente-laundry.md` | Constitución del agente de clientes |
| `prompt-operador-laundry.md` | Constitución del agente de planta (operador y admin) |
| `generador/` | Scripts que producen el JSON a partir de la base de 321 |
| `versiones/v1.0/` | Respaldo del estado con el número de prueba |
| `referencia/` | Workflows de 321 de solo lectura. **No se modifican.** El agente de 321 ya no se versiona (traía una credencial literal): vive solo en Descargas |
| `verificar-prompts.cjs` | Comprueba que los prompts publicados en n8n son idénticos a los `.md` |

Una prueba (`tests/unit/workflow-laundry-agente.test.ts`) exige que los
prompts del JSON sean idénticos a los `.md`, que no quede nada de 321, que no
haya llaves literales, que se transcriba con `gpt-transcribe` y que ninguna
tool mueva dinero.

## Generar el JSON

```bash
node n8n/generador/generar.cjs
```

Lee `iAgente 321 INMO V2.json` de Descargas (o la ruta que pases como
argumento). Ese archivo **no se versiona**: trae un secreto de 321.

| Módulo | Aporta |
|---|---|
| `generar.cjs` | Recorte de la base, cuenta 3, phone ID, visión, transcripción, conexiones |
| `herramientas-cliente.cjs` | Las 6 tools del agente de clientes |
| `operador.cjs` | Verificar Operador, ¿Es Operador?, Agente Operador y sus tools |
| `guardia.cjs` | Guardia anti-alucinación en `Extraer JSON` |
| `crm.cjs` | Registro de cliente y conversación en el CRM en cada turno |
| `resumen.cjs` | Resumen de las 8:00 para admins: texto libre o plantilla según la ventana de 24 h |

## Aplicar cambios en n8n

Por MCP, sobre el workflow existente: `update_workflow` con operaciones
puntuales y luego `publish_workflow`. **No reimportes el JSON**: crea otro
workflow con otro id, apaga el acceso MCP y choca la ruta `laundry-vip` con el
activo.

## Credenciales (en n8n, nunca en el JSON)

| Nombre | Tipo | Para qué |
|---|---|---|
| `Chatwoot Laundry VIP API` | Header `api_access_token` | Leer y responder en la cuenta 3 |
| `Meta WhatsApp Laundry VIP` | Header `Authorization: Bearer …` | Indicador de escribiendo y plantilla del resumen |
| `CRM Laundry VIP Webhook` | Header `x-webhook-secret` | Todas las tools contra `/api/webhook` |
| `Postgres Laundry VIP` | Postgres (session pooler) | Memoria de conversaciones |
| `OpenAi account` | OpenAI | Compartida con 321, temporal |
