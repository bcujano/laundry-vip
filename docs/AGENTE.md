# El agente de WhatsApp: cómo funciona y cómo se cambia

Complemento de [`CONTINUIDAD.md`](CONTINUIDAD.md). Aquí está la mecánica; el
estado y lo pendiente están allá. Los prompts viven en
[`../n8n/prompt-agente-laundry.md`](../n8n/prompt-agente-laundry.md) (clientes)
y [`../n8n/prompt-operador-laundry.md`](../n8n/prompt-operador-laundry.md)
(planta y dueña) y son la fuente de verdad de **cómo se porta**: léelos antes
de tocar el comportamiento.

## 1. El flujo

```
WhatsApp → Meta (app Laundry VIP) → Chatwoot cuenta 3 → webhook → n8n
  Rama persona     (mensaje saliente de alguien que NO es «Agente VIP» → etiqueta «humano»)
  Filtro Chatwoot  (solo message_created + incoming)
  Filtro Humano    (la etiqueta «humano» en la conversación apaga el agente)
  → WhatsApp Inicio → Debounce 7 s → ¿es el último mensaje?
  → Registrar Entrante (CRM: cuenta 1 mensaje, deduplica, ¿tope de mensajes o de gasto?)
  → combina textos → texto | audio (gpt-transcribe) | imagen (visión → hechos)
  → Verificar Operador (CRM: ¿es número autorizado? + datos del negocio)
  → ¿Es Operador?
       sí → Agente Operador  (nivel operador, o admin = la dueña)
       no → Agente Laundry VIP (clientes; 6 tools: cotizar_prendas,
            obtener_proxima_ventana, verificar_cobertura, find_or_create_client,
            crear_pedido, consultar_estado_pedido)
  → Extraer JSON (parser + GUARDIA) → respuesta por Chatwoot
                                   → ¿escalar? → etiqueta «humano» + nota
                                   → Registrar cliente y conversación en el CRM
                                   → Estimar Uso → Registrar Uso (costo OpenAI estimado)

Cada 5 min (L-S 9:00–18:55)  Seguimiento: el CRM dice a quién y qué paso toca (5 min, 1 h,
  6 h, 23 h 30) → ¿hay persona a cargo? → ¿ya compró / rechazó? (clasificador) → redacta →
  Chatwoot + memoria del agente + CRM; con el paso 1 además resume a la dueña (nota y WhatsApp).
Cada 5 min (L-S 9:00–18:55)  Avisos de discrepancia: manda el texto del CRM si la ventana de
  24 h está abierta; si no, nota interna «requiere_persona».
Resumen 8:00 (L-S) → datos del CRM → un mensaje por admin → ¿escribió en < 23 h?
       sí → texto libre · no → plantilla resumen_diario_admin (no existe: no llega)
```

- **Debounce de 7 s:** el agente espera 7 s de silencio antes de contestar,
  para juntar ráfagas de mensajes. El cliente lo nota (hay huecos de medio
  minuto en los chats reales); es deliberado.
- **Quién publica qué en Chatwoot:** desde el 2026-10-01 el agente responde con su propio usuario, **«Agente VIP»** (id 8); antes usaba el token de «Byron ADMIN». En las transcripciones `SALE(Agente VIP)` es el agente; cualquier otro nombre (María Sol, Daniel, Byron) es una persona escribiendo a mano, y los `SALE(Byron ADMIN)` anteriores al 2026-10-01 son del agente.
- **Coexistencia persona–agente (B1, hecho 2026-09-30):** si una persona del
  equipo contesta a mano (remitente ≠ «Byron ADMIN», mensaje público), la rama
  `Respondio Persona?` pone la etiqueta `humano` y deja una nota interna; el
  agente se calla hasta que alguien la quite. Un mensaje del agente ya en vuelo
  lo aborta `Es Ultimo Mensaje?`. Antes de esto el agente contestaba encima de
  María Sol (precios contradictorios: $3,75 ella, $7,50 el agente).
- **La etiqueta `humano`** la pone el propio agente al escalar, y también se
  puede poner a mano. Mientras esté, el agente no contesta esa conversación.
  Quitarla devuelve el control. **Ojo:** probar al agente escribiéndole «mal
  servicio» desde un número autorizado lo escala y lo deja mudo.

## 2. Qué lee del CRM en cada mensaje (nada de esto está en el prompt)

| Dato | Viene de | Por dónde llega al agente |
|---|---|---|
| Precios, métodos, unidades, promociones | tabla `servicios` | `cotizar_prendas` |
| Cómo nombra el cliente cada prenda | `servicios.sinonimos` | `cotizar_prendas` (emparejador) |
| Dirección, fijo, enlace de mapa | `configuracion` | `Verificar Operador` → `negocio` |
| Nombre del negocio | `configuracion.nombre_negocio` | `Verificar Operador` → `negocio.nombre` |
| Horario en palabras | `configuracion` (apertura, cierre, cierre sábado, días) | `obtener_proxima_ventana` → `horario` |
| Hasta dónde se recoge | `configuracion.radio_cobertura_km` | `obtener_proxima_ventana` → `cobertura` |
| Tarifa de recogida y entrega | `configuracion.tarifa_recoleccion_entrega` | `obtener_proxima_ventana` |
| Plazo de entrega | `configuracion.horas_entrega_min/max` | `obtener_proxima_ventana` |
| Ventana de recolección (cualquier día) | `configuracion` + reloj | `obtener_proxima_ventana` con `desde` |

**Dirección, fijo y enlace de mapa** también salen de Configuración (`negocio.direccion`, `negocio.telefono`, `negocio.enlace_mapa`, vía `Verificar Operador`). Ya no queda nada del negocio escrito en el prompt.

## 3. Las herramientas

**Clientes (6), todas contra `POST /api/webhook` con el secreto
`x-webhook-secret`:** `cotizar_prendas`, `obtener_proxima_ventana`,
`verificar_cobertura`, `find_or_create_client`, `crear_pedido`,
`consultar_estado_pedido`.

**Planta (operador y admin):** `cotizar_prendas_operador`,
`registrar_cliente_presencial`, `actualizar_registro`, `consultar_pedido`,
`buscar_pedidos`, `avanzar_estado`, `registrar_conteo`. **Solo admin:**
`generar_reporte` y `consulta_admin` (`como_vamos`, `resumen`, `atencion`,
`cola_manana`, `leads_calientes`, `clientes_top`).

**Los permisos los decide el servidor**
(`src/server/webhook/handlers/permisos.ts`), nunca el prompt: un operador que
pide `como_vamos` recibe `OPERADOR_NO_AUTORIZADO` del servidor aunque el modelo
lo intente.

**Nada de dinero por WhatsApp:** confirmar pagos, corregir montos, cerrar
discrepancias, cancelar y borrar no existen como acciones del webhook.
**Excepción autorizada (2026-09-30):** el aviso automático de discrepancia. Cuando
el conteo en planta no cuadra (`verificarConteo`) o se corrige un monto
(`corregirCotizacion`), el servidor guarda un aviso (`avisos_cliente`) con texto
propio y cifras de la base; el flujo `Avisos cada 5 min` lo manda al cliente si su
ventana de 24 h está abierta, o deja una nota interna para que una persona lo
llame (estado `requiere_persona`). No pide pago, no da cuentas y no negocia; si el
cliente responde, el prompt (§4.9) obliga a escalar.

**La guardia** (`Extraer JSON`, `n8n/generador/guardia.cjs`): si el agente
dice que algo quedó registrado sin que la tool haya respondido `ok:true`, o
escribe un UUID que no salió de una tool, el mensaje se reemplaza. Nació de
una orden inventada con ID falso.

## 4. Reglas de comportamiento (resumen; manda el prompt)

- **Cliente:** saluda natural y distinto cada vez, atiende lo que pidió y
  pregunta el nombre; **no se anuncia como asistente virtual** (asusta al
  cliente de barrio) pero **si le preguntan de frente no miente**; lee el tono y
  se ajusta; una sola pregunta por mensaje; usted siempre; lista negra de
  frases de call center; el aviso de la ley de datos va **una vez, al pedir los
  datos del cierre**, no en el saludo.
- **Nunca niega un servicio:** si `cotizar_prendas` no encuentra, pregunta con
  las `sugerencias` o dice que lo confirma con planta. «No ofrecemos…» está
  prohibido.
- **Siempre un estimado en dólares**, y después el «se verifica en planta».
- **Ropa de diario al peso** ($/libra); por prenda solo lo del catálogo
  (ternos, vestidos, edredones…). Las cortinas van por **kilo**.
- **Sin dirección no hay pedido** cuando la lavandería recoge (lo rechaza el
  servidor). **Nunca inventa el nombre:** solo el que el cliente escribió.
- **Cobertura:** pregunta el sector antes de prometer la recogida; fuera del
  radio ofrece traer y retirar en el local.
- **Otro día:** si el cliente pide otra fecha, vuelve a llamar a
  `obtener_proxima_ventana` con `desde`; jamás dice «ese día no hay» por su
  cuenta ni confirma una fecha distinta de la que devolvió la herramienta.
- **Dueña (admin):** de usted y por su nombre, servicial y con iniciativa;
  responde con datos del CRM + una lectura corta + el siguiente paso útil.

## 5. Cómo cambiar el agente

1. **Edita el prompt `.md`** (o el generador en `n8n/generador/`) y regenera:
   ```bash
   node n8n/generador/generar.cjs        # debe decir «OK: 100 nodos»
   pnpm biome check --write n8n
   ```
   El generador lee `iAgente 321 INMO V2.json` de **Descargas** (ya está ahí).
   **Ese archivo no se versiona** (trae una credencial literal de 321) y una
   prueba (`tests/unit/sin-secretos.test.ts`) impide que entre al repo.
2. **Gate completo:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
   La prueba `workflow-laundry-agente.test.ts` exige que el prompt del JSON sea
   idéntico al `.md` y que estén las reglas duras.
3. **Sube a n8n por MCP** (autorizado por el dueño **solo para el workflow
   `Bleb55WBKPfBdxVg`**): `update_workflow` con `setNodeParameter`, p. ej.
   `nodeName: "Agente Laundry VIP"`, `path: "/options/systemMessage"`; luego
   `get_workflow_history` para tomar el `versionId` nuevo y `publish_workflow`
   con ese `versionId`. **Nunca reimportes el JSON entero:** cambia el id, apaga
   el acceso MCP y choca la ruta `/webhook/laundry-vip`.
4. **Verifica que n8n quedó idéntico al repo** (obligatorio: transcribir a mano
   se come tildes, ya pasó con «propón»):
   - `get_workflow_details` con `detailLevel: "full"`. Pesa ~90 KB, así que el
     MCP lo guarda en un archivo y te da la ruta.
   - `node n8n/verificar-prompts.cjs <esa-ruta>`: debe decir `OK … idéntico`
     para los dos agentes (código de salida 0). Si dice `FALLA`, muestra las
     líneas que difieren.
5. **Verifica el manejo de errores** (obligatorio tras crear nodos por MCP):
   `node n8n/verificar-errores.cjs <esa-misma-ruta>`. El MCP **pierde `onError`** al hacer
   `addNode`; si dice `FALLA`, copia sus operaciones `setNodeSettings` a `update_workflow`,
   publica y vuelve a correrlo hasta ver `OK`. (Sin esto un 404 de Chatwoot detuvo el flujo de
   avisos el 2026-10-01 y `Registrar Entrante` dejaba de ser a prueba de fallos.)
6. **Verifica con el mundo real:** `pnpm chatwoot:revisar --desde AAAA-MM-DD`
   y lee cómo contestó el agente, o `search_workflow_executions` /
   `get_workflow_execution` con `includeData`.

Trampas del MCP: `versionName` admite **80 caracteres** como máximo; `addNode` no fija
`onError` (ver paso 5); un `getWorkflowDetails` pesa >100 KB y se guarda en un archivo;
y el prompt entero hay que mandarlo completo en cada `setNodeParameter` (no hay parche parcial),
así que se cambia de una vez y se verifica con `verificar-prompts.cjs`.

Notas del MCP: el historial de versiones se purga (un `get_workflow_versions_diff`
contra una versión vieja responde «not found»); al cambiar una tool, su
`jsonBody` y su `toolDescription` se actualizan por separado; y si el MCP dice
«Workflow is not available in MCP», el dueño debe activarlo en la tarjeta del
workflow (se apaga cada vez que se reimporta).

## 6. Revisar cómo se porta el agente con clientes reales

```bash
pnpm chatwoot:revisar --desde 2026-09-30 --salida chats.txt
```

Solo lectura y **solo la cuenta 3** (se niega a correr con otra). Es la
auditoría más barata: dos revisiones así (2026-09-24 y 2026-09-30)
encontraron todos los errores de [`DECISIONES.md`](DECISIONES.md) §2. Regla de
oro: **cada frase real que falle se convierte en una prueba**
(`tests/unit/emparejar.test.ts`, `tests/integration/cotizar.test.ts`) y, si es
de comportamiento, en una regla del prompt con su ejemplo.

## 7. Usuario de Chatwoot propio del agente (hecho el 2026-10-01)

Antes el agente publicaba con el token de «Byron ADMIN» y no se podía distinguir del dueño. Se resolvió así (queda como receta por si hay que repetirlo, p. ej. al rotar el token):

1. **Chatwoot (cuenta 3) → Configuración → Agentes → Agregar agente.** Nombre
   «Agente VIP», rol Agente, un correo propio (sirve un alias: `tucorreo+agentevip@gmail.com`).
2. **Bandejas → «Vip Laundry» → Colaboradores:** agrega a «Agente VIP», o no podrá
   publicar en esa bandeja.
3. Entra con ese usuario (ventana privada) → avatar → **Configuración del perfil →
   Token de acceso** → copiar.
4. **n8n → Credenciales → «Chatwoot Laundry VIP API»:** pega el token nuevo en la
   cabecera `api_access_token` y guarda. (Es la credencial nuestra; no toques las de 321.)
5. El nombre del usuario vive en `n8n/generador/agente.cjs` (`NOMBRE_AGENTE`, y la
   hora de corte para los mensajes viejos de «Byron ADMIN»); si cambia, se regenera y
   se publica. Desde ahí, cualquier mensaje de una persona (incluido Byron) pausa al
   agente en ese chat.
6. **Ojo con los scripts:** `scripts/seguimiento-barrido.ts` publica con el token de
   `CHATWOOT_API_TOKEN` en `.env.local`. Si sigue siendo el de Byron, sus mensajes
   saldrían como «Byron ADMIN» y pausarían el chat; para un barrido usa el token de
   «Agente VIP» en esa variable.
