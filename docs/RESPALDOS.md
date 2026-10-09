# Puntos de respaldo y cómo volver atrás

Antes de cada fase grande se deja un punto de retorno en las **cuatro** piezas. Todo cambio se hace
sobre uno de estos puntos conocidos, nunca sobre el aire.

| Pieza | Cómo se respalda | Cómo se vuelve |
|---|---|---|
| **Código** | etiqueta de git `respaldo-AAAA-MM-DD-<motivo>` (subida a GitHub) | `git checkout <etiqueta>` en una rama nueva; el CRM se redespliega con `npx vercel --prod --yes` (o «Promote» de un deploy viejo en Vercel) |
| **Base** | `pnpm db:respaldo <etiqueta>` → `respaldos/<fecha>-<etiqueta>/<tabla>.json` (fuera de git: datos de clientes). `pnpm db:respaldo --listar` | Las migraciones solo **agregan** (nunca se edita una aplicada): volver atrás es ignorar la columna o tabla nueva. Para datos, se restauran filas del JSON a mano y con cuidado |
| **n8n** | cada publicación por MCP crea una versión con nombre; se anota el `versionId` activo | `restore_workflow_version` con ese id y `publish_workflow`; luego `node n8n/verificar-prompts.cjs` y `verificar-errores.cjs` |
| **Chatwoot / Meta** | no se cambian por código | — |

## Puntos de retorno vigentes

| Etiqueta | Fecha | Qué contiene | n8n activo en ese momento |
|---|---|---|---|
| `v1.0` | 2026-09 | estado con el número de prueba | — |
| `respaldo-2026-10-09-antes-fases-sol` | 2026-10-09 | CRM con plazo por servicio (migración 0020), informe del cuestionario; antes de construir las fases 0–6 | `5bbeadd7-4f43-4052-abcb-1918c6f13380` |

Respaldo de datos local: `respaldos/2026-10-09-*-antes-de-fases-sol` (18 tablas) y, dentro, el JSON del
workflow n8n de esa versión. **Cada punto nuevo se agrega a esta tabla.**

## Reglas para que el sistema siga siendo limpio y replicable

1. Todo dato de negocio (nombre, saludo, precios, plazos, horarios, zonas, textos de política) vive en el
   CRM, nunca en el código ni en el prompt: otra lavandería se monta cargando sus datos, no editando código.
2. Cada cambio de esquema es una migración nueva, aditiva y con valor por defecto, para que el código viejo
   siga funcionando mientras se despliega el nuevo.
3. Orden de despliegue: migración → CRM → n8n (nunca al revés).
4. Todo cambio al agente pasa por el gate, `verificar-prompts.cjs` y `verificar-errores.cjs`.
5. Lo que afecta al cliente se prueba contra producción con `curl` o con tráfico real antes de darlo por hecho.
