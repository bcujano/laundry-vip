# Estado y continuidad

Última actualización: **2026-09-30** (cierre de sesión). Es el primer archivo
que se lee en cada sesión; está escrito para arrancar **sin hacerle preguntas
al dueño**. Mapa de documentos:

| Archivo | Para qué |
|---|---|
| **este** | Arranque, estado real, acciones inmediatas, plan y pendientes |
| [`AGENTE.md`](AGENTE.md) | Cómo funciona el agente de WhatsApp y cómo se cambia (MCP de n8n) |
| [`DECISIONES.md`](DECISIONES.md) | Lo que el dueño decidió (no revertir) y los fallos ya encontrados |
| [`CHATWOOT_Y_WHATSAPP.md`](CHATWOOT_Y_WHATSAPP.md) | De dónde sale cada credencial de integración |
| [`DESPLIEGUE.md`](DESPLIEGUE.md) | Despliegue del CRM |
| [`historia-agente.md`](historia-agente.md) | Por qué el agente nació clonado de 321 |
| `GUIA_CONSTRUCCION…`, `PLANO_PROYECTO`, `PROMPT_CONSTRUCCION…`, `CUESTIONARIO…` | **Históricos de la construcción.** Traen valores viejos (combo, 5 km…): no son fuente de verdad |

---

## 0. Arranque

**Prompt para abrir la siguiente sesión** (el dueño lo pega tal cual):

> Continúo Lavandería VIP en `C:\dev\laundry-vip`, en producción con clientes
> reales (CRM https://laundry-vip.vercel.app · agente de WhatsApp en n8n,
> workflow `Bleb55WBKPfBdxVg` · número +593 98 566 2822). Lee `CLAUDE.md` y
> `docs/CONTINUIDAD.md` completos, y `docs/AGENTE.md` y `docs/DECISIONES.md`
> antes de tocar el agente. No me hagas preguntas: ejecuta la «§3 Acciones al
> arrancar» (las autorizo todas), sigue con el «§4 Plan» en el orden escrito
> sin parar, y al final reporta qué hiciste, qué verificaste contra el sistema
> real y qué quedó esperando algo mío (§5), con lo que hiciste por defecto.
> No toques nada de 321.

**Verificación en 1 minuto** de que todo sigue vivo:

```bash
curl -s https://laundry-vip.vercel.app/api/health
pnpm typecheck && pnpm lint && pnpm test
```

Y en n8n (MCP): `search_workflow_executions` sobre `Bleb55WBKPfBdxVg` con
`status: ["error","crashed"]`. Hay **una** ejecución `crashed` del 2026-09-30
17:26Z sin `startedAt` (probablemente un reinicio de n8n); si aparecen más,
investígalas. Si el MCP dice «Workflow is not available in MCP», el dueño debe
activarlo en la tarjeta del workflow.

---

## 1. Dónde está cada cosa

| | |
|---|---|
| CRM | **https://laundry-vip.vercel.app** · Vercel `bcujanos-projects/laundry-vip` · deploy: `npx vercel --prod --yes` desde `C:\dev\laundry-vip` (el CLI ya tiene sesión) |
| Base | Supabase `cvdlslltevwxprdktmfu` (São Paulo). **Una sola base: pruebas y producción comparten.** Migraciones `0001`–`0019` aplicadas |
| Agente | n8n `https://primary-production-ed243.up.railway.app` · workflow **`Bleb55WBKPfBdxVg`** «iAgente Laundry VIP» · 93 nodos · activo · versión activa `7aeab449-dd10-4ceb-b7c2-3d477224b9ff` (2026-09-30) |
| Chatwoot | `https://chatwoot-production-8564.up.railway.app` · **cuenta 3** · bandeja «Vip Laundry». La cuenta 1 es de 321: **no se toca ni para leer** |
| WhatsApp | **+593 98 566 2822** · phone ID `1220603671147410` · WABA `1755486442349144` · app Meta «Laundry VIP» |
| Repo | `github.com/bcujano/laundry-vip` (privado) · rama `agente-n8n-laundry` y etiqueta `v1.0` subidas el 2026-09-30. Local en `C:\dev\laundry-vip`. Historial reescrito el 2026-09-23 (los SHA cambiaron) |
| Gate | typecheck, lint, build y **309 pruebas** en verde · 10 E2E de Playwright (`pnpm test:e2e`, necesita `pnpm build` y el puerto 3000 libre) |
| Credenciales en n8n | `CRM Laundry VIP Webhook` (id `9456EHfb8yxpZOmr`), `Chatwoot Laundry VIP API`, `Meta WhatsApp Laundry VIP`, `Postgres Laundry VIP`, `OpenAi account` (compartida con 321). Nunca en el JSON |
| Variables (`.env.local`) | Solo nombres aquí: `SUPABASE_*`, `N8N_WEBHOOK_SECRET`, `CHATWOOT_*`, `WHATSAPP_*`, `OPENAI_API_KEY`, `LOCAL_LATITUD/LONGITUD/DIRECCION` |

**Personas:** Byron David (dueño, superadmin, `brncjn@gmail.com`) · **María Sol
Játiva** (administradora/dueña en la operación diaria, `+593 98 509 1860`) ·
Daniel Serrano (operador de planta, `+593 99 304 6212`). Lista blanca de
WhatsApp: María Sol (admin) y Daniel (operador). Byron **no** está en la lista
blanca: sus pruebas con el número de 321 entran como cliente.

**Configuración hoy (la edita el dueño en el CRM):** «VIP Laundry» · lunes a
sábado · 9:00–19:00, sábados hasta 17:00 · recolección a **2,5 km** del local ·
tarifa de recogida y entrega **$2,50** · entrega **48–72 h** · tope de mensajes
40/teléfono/día y tope de gasto OpenAI $5/día (**conectados el 2026-09-30, pendientes de verse con tráfico real, §4 B2**).

**Datos hoy:** base entregada en cero el 2026-09-23 y desde entonces entraron
clientes reales: 14 clientes, 15 conversaciones, **1 pedido** (defectuoso, ver
§5 E1), 0 errores del agente. Catálogo: 54 servicios con sinónimos.

---

## 2. Comandos

| Comando | Para qué |
|---|---|
| `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` | el gate (los cuatro, siempre) |
| `pnpm chatwoot:revisar --desde AAAA-MM-DD [--salida f.txt]` | transcripciones del agente con clientes reales (solo lectura, cuenta 3) |
| `node n8n/generador/generar.cjs` | regenera el JSON del workflow desde los prompts |
| `node n8n/verificar-prompts.cjs <archivo>` | comprueba que n8n quedó idéntico al repo (ver `AGENTE.md` §5) |
| `pnpm db:migrate` | aplica migraciones nuevas (nunca se edita una aplicada) |
| `pnpm db:seed` / `--forzar` | carga el catálogo **solo si está vacío** / reimpone la lista del archivo (pisa al dueño) |
| `pnpm db:reset-clientes` / `--confirmar` | simula / **borra sin vuelta atrás** clientes, pedidos, conversaciones y memoria del agente |
| `pnpm db:staff` · `pnpm db:password <correo>` | cuentas del CRM |
| `pnpm check:integraciones` | las 9 variables de integración (falla si falta alguna) |
| `pnpm db:demo` | datos de ejemplo. **No los cargues sin permiso del dueño** |
| Webhook a mano | `curl -X POST https://laundry-vip.vercel.app/api/webhook -H "content-type: application/json" -H "x-webhook-secret: $N8N_WEBHOOK_SECRET" -d '{"accion":"cotizar_prendas","parametros":{"items":[{"descripcion":"hacen tintura","cantidad":1}]}}'` |

Scripts sueltos contra la base: `scripts/` no usa el alias `@/`; en Windows los
`.mts` fuera del repo importan con `file:///C:/...`.

---

## 3. Acciones al arrancar (el dueño las autoriza al pegar el prompt)

1. **Verificación de 1 minuto** (§0). Si algo está rojo, arréglalo antes de seguir.
2. **Conversación 5 de María Sol — RESUELTO (2026-09-30).** La etiqueta `humano` ya no está (Byron la quitó a las 21:11Z); con B1 ahora, si ella responde a mano en un chat de cliente, el agente se calla solo en ese chat. Comprobar que el agente le contesta cuando ella le escribe al número del negocio.
3. **Revisar lo que pasó con clientes reales desde la última revisión** (cubrió
   hasta 2026-09-30 18:12Z): `pnpm chatwoot:revisar --desde 2026-09-30`. Busca
   lo de `DECISIONES.md` §2: negaciones de servicio, promesas fuera de
   cobertura, precios que no salen del catálogo, nombres inventados, pedidos
   sin dirección, respuestas dobles, el agente contestando encima de María Sol.
   **Cada falla: primero prueba, luego arreglo, luego verificación en
   producción.** Anota en §5 lo que no puedas resolver tú.
4. **Comprobar el resumen de las 8:00** cuando María Sol ya haya escrito al
   agente (`operador_whitelist.ultimo_mensaje_en` deja de ser `null`): ver la
   ejecución del nodo `Resumen 8:00` y que llegó a su WhatsApp. Sin plantilla
   aprobada, solo llega si ella le escribió al agente en las últimas 23 h.

---

## 4. Plan de desarrollo (en este orden, sin parar)

Cada punto termina con: gate verde → deploy → verificación contra producción →
commit → si tocó el agente, publicación en n8n + `verificar-prompts.cjs` →
actualizar esta sección.

**B1 · Coexistencia persona–agente — HECHO (2026-09-30).** Rama paralela del webhook (`n8n/generador/persona.cjs`): mensaje saliente público de un usuario de Chatwoot distinto de «Byron ADMIN» → etiqueta `humano` (conserva las otras) + nota interna. Verificado en producción simulando el webhook sobre la conversación 5 (etiquetó; «Byron ADMIN» no dispara). Limitación: las respuestas manuales de Byron desde Chatwoot no apagan al agente hasta que exista el usuario del agente (E10). La etiqueta se queda hasta que alguien la quite. Falta verlo con María Sol real.

**B2 · Protecciones conectadas — PUBLICADO (2026-09-30), PENDIENTE DE VER CON TRÁFICO REAL.** `n8n/generador/protecciones.cjs`: tras el debounce, `Registrar Entrante` llama a `registrar_evento_entrante` con el teléfono en el sobre (cuenta **un mensaje por turno**, deduplica por id de mensaje de Chatwoot, y devuelve `costo_excedido`); `Puede Continuar?` corta si es repetido, si pasó el tope diario (nota interna para el equipo, sin responder al cliente) o si el gasto del día pasó el techo (aviso al cliente). Un fallo del CRM deja pasar al cliente. Al final del turno `Estimar Uso` → `Registrar Uso` reporta un costo **estimado** (n8n no expone los tokens del agente; la estimación va por encima de lo real). **Primera acción de la próxima sesión:** con un mensaje real, comprobar que `mensajes_diarios`, `eventos_procesados` (claves `chatwoot-…` y `uso-…`) y `uso_openai_diario` dejan de estar vacías, y que el costo estimado por turno es razonable frente a la factura de OpenAI.

**B3 · Dirección, fijo y mapa en Configuración — HECHO (2026-09-30).** Migración `0014` (`direccion_local`, `telefono_local`, `enlace_mapa`, sembrados con los valores que traía el prompt); `verificar_whitelist_operador` y `obtener_proxima_ventana` los devuelven; el prompt del agente de clientes los lee de `negocio`; la pantalla de Configuración los edita (y de paso ahora también edita el cierre de sábado y el radio de recogida, que faltaban en el formulario). El `saludo_agente` **no se conectó a propósito**: la decisión del 2026-09-24 es que el saludo cambia cada vez; el campo sigue en pantalla pero el prompt no lo usa (ver si se quita).

**B4 · Cobertura verificable — ACTIVA (2026-09-30).** Migración `0015` (`configuracion.sectores_cobertura`) y validación en el handler de `crear_pedido` del agente (`FUERA_DE_COBERTURA` / falta de sector; el CRM puede crear excepciones a mano). **Lista cargada por el dueño: 36 sectores a ≤2,5 km del local**, sacados de OpenStreetMap (nodos `place=suburb|neighbourhood|quarter` dentro de 2,5 km de `-0.1382973,-78.4820373`, distancia recalculada con haversine). Ojo: varios nombres existen también lejos (San Carlos, La Luz, El Carmen, La Florida, El Edén, Nazareth); el agente ya pide calle y referencia, y el equipo puede ajustar la lista en Configuración. Verificado en producción: `Cumbayá` → `FUERA_DE_COBERTURA`; sin sector → pide sector; `La Kennedy` pasa.

**S1 · Agente de seguimiento — ACTIVO (2026-09-30, lo pidió el dueño tras ver un borrador real).** Retoma a quien pidió precio y dejó de contestar, dentro de las 24 h de WhatsApp (fuera de ellas Meta exige plantilla). **Cuatro mensajes por silencio del cliente: a los 30 min, 1 h, 6 h y 23 h 30 min** (el último sale antes de las 23 h 54 min); si en ese lapso no contrata, no se insiste más. n8n pregunta cada 5 min (lunes a sábado, 9:00–18:55); `candidatos_seguimiento` (CRM: `src/server/seguimiento/`) dice a quién y qué paso le toca: lead tibio/caliente, sin pedido, sin escalar, que no sea del equipo y al que no se le mandó ya ese paso en ese silencio (tabla `seguimientos`, migración 0016–0017). Solo dentro del horario del local: un paso que no pudo salir a tiempo (de noche, domingo, n8n caído) **sale en cuanto se puede, y solo el más reciente** (nunca varios de golpe) mientras la ventana de 24 h siga abierta. n8n confirma en Chatwoot que no hay etiqueta `humano` ni respuesta de una persona en 24 h; OpenAI (gpt-4.1-mini) redacta ≤35 palabras con la intención de cada paso (recordatorio · resolver duda · propuesta concreta · cierre cordial) y sin repetir lo ya enviado; una guardia descarta montos no dichos. Lo enviado en modo activo queda en la memoria del agente (patrón tomado del follow-up de 321, `Guardar Followup en Memory`). **Modo en Configuración** (`seguimiento_modo`): `apagado` · `borrador` (nota interna en Chatwoot) · `activo` (escribe al cliente; **es el de hoy**). El saludo («buenos días/tardes/noches») lo fija el código según la hora de Quito, no el modelo (a las 5 pm salió «buenos días»). **Barrido del 2026-09-30 (orden del dueño):** se mandó el primer seguimiento a los 8 leads (registrado en el paso que tocaba por su silencio, para que el flujo no mande otro enseguida) con ventana abierta, incluso a los que María Sol ya había contestado (13, 14, 15, 16, 19), con `scripts/seguimiento-barrido.ts` (`mensajes.json` con un texto por teléfono; `--simular` no envía; respeta ventana de 24 h, pedido previo y montos no dichos; registra el paso que tocaba). Los pasos siguientes siguen el flujo normal, y **esos 5 chats siguen el flujo sin el filtro «una persona ya contestó»** (`seguimientos.barrido`, migración 0018; decisión del dueño). Solo los frenan un pedido agendado o confirmado, la etiqueta `humano` o una conversación resuelta. Pendiente: revisar con `pnpm chatwoot:revisar` los primeros seguimientos enviados de verdad y afinar el texto.

**S2 · Detección de conversión — PUBLICADO (2026-09-30).** Antes de insistir, el seguimiento lee la conversación en Chatwoot y un clasificador (gpt-4.1-mini, `temperature 0`) dice `vendido` · `agendado` · `rechazado` · `abierto` (ante la duda, `abierto`). Si compró o agendó: `registrar_conversion` (CRM) agrega al cliente si falta, marca `conversaciones.contexto.estado_comercial` **sin tocar `ultima_interaccion`** y una nota interna avisa si **falta crear el pedido** (el pedido no se inventa desde un chat). Si rechazó, no se le insiste. Si el cliente vuelve a escribir, se reevalúa. **Pendiente (decisión de María Sol, Anexo A del PDF):** reglas de intervención de la dueña (#bot, #venta, #seguir, vencimiento de la pausa, nota de traspaso, avisos por WhatsApp) y si el agente debe crear el pedido él mismo.

**S3 · Cuestionario de conocimiento — ENTREGADO (2026-09-30).** `docs/Cuestionario_Conocimiento_del_Agente.pdf` (37 páginas, 173 preguntas + 44 escenarios + Anexo A de reglas de intervención). Fuente en `docs/cuestionario/*.md`; se regenera con `python scripts/cuestionario_pdf.py`. **Cuando María Sol lo devuelva:** cargar datos al CRM (precios, zonas en `sectores_cobertura`, horarios, plazos), escribir las reglas en los prompts con ejemplos y convertir cada escenario en prueba.

**B5 · Búsqueda de Chatwoot por teléfono — VERIFICADA POR API (2026-09-30).** `contacts/search?q=` de la cuenta 3 encuentra al contacto con el teléfono con o sin `+` y con el número local sin prefijo; `conversations/search` por teléfono no devuelve nada (busca en el contenido de los mensajes). El enlace del CRM (`/search?q=<dígitos>`) es de la pantalla de Chatwoot y **no se pudo probar en el navegador** (pide sesión): el dueño puede comprobar un botón «abrir en Chatwoot» de un cliente sin conversación registrada.

**B6 · GitHub — HECHO (2026-09-30):** `git push -u origin agente-n8n-laundry --tags`. Falta revisar que `.github/workflows/ci.yml` corra el gate con las variables como *secrets* (las pruebas de integración tocan la base real: **no** les des las llaves de producción, ver B8).

**B7 · Funcionalidad pendiente del CRM.**
- **Aviso automático de discrepancia al cliente — HECHO (2026-09-30)**, excepción autorizada a la regla 10 (ver `CLAUDE.md`). Migración `0019` (`avisos_cliente`), `src/server/avisos/`, flujo `Avisos cada 5 min` en n8n (dentro de las 24 h se manda; fuera queda nota interna `requiere_persona`). **Sin ver con un caso real todavía** (nunca ha habido un conteo que no cuadre). Pendiente: plantilla de Meta `aviso_diferencia` (Utilidad) para poder avisar fuera de las 24 h.
- **Pantalla para cerrar el mes** de clientes `consolidado_mensual`: explicada al dueño, **se construye cuando exista el primer cliente con facturación mensual**.
- **`meta_referrals` (origen de los anuncios): el dueño lo dejó para más adelante.** Patrón en `n8n/referencia/Meta-Referral-Capture.json`.

**B8 · Infraestructura propia** (depende del dueño, §5 E8): segundo proyecto de
Supabase para producción (hoy las pruebas borran y crean filas en la base
real); instancias propias de n8n y Chatwoot; clave de OpenAI propia con tope.
Al separar la base hay que cambiar **tres** sitios: variables del CRM en Vercel,
la credencial `Postgres Laundry VIP` de n8n (memoria del agente) y `.env.local`;
y rotar la contraseña de la base al estrenar la de producción.

---

## 5. Esperando al dueño (con lo que haces por defecto mientras tanto)

| # | Qué falta | Por defecto, sin preguntarle |
|---|---|---|
| E2 | **Plazo de entrega:** Configuración dice 48–72 h; María Sol a veces dice «48 h» y otras «24 a 48» | Se mantiene 48–72 h |
| E4 | **Plantilla de Meta `resumen_diario_admin`** (categoría Utilidad, idioma `es`, 7 variables) | Sin plantilla: el resumen de las 8:00 solo llega si la admin escribió al agente en las últimas 23 h. Que María Sol le escriba algo cada día antes de las 8:00 |
| E7 | **Borrar `Descargas\laundry-vip-respaldo-antes-de-limpiar-historial.bundle`**: es el historial viejo y **contiene la credencial de 321** | Nada |
| E8 | **Separar pruebas de producción:** hoy las pruebas de integración corren contra la MISMA base de Supabase que usan los clientes reales (la base es solo de VIP: no tiene tablas de 321). Hace falta un segundo proyecto de Supabase para pruebas. Además: OpenAI propia con tope de gasto, n8n y Chatwoot propios (hoy compartidos con 321) | Las pruebas siguen usando prefijos propios y limpian lo suyo |
| E9 | **Limpiar Chatwoot** (conversaciones de prueba; el contacto «321 Soluciones Inmobiliarias» es el número de 321 de Byron usado para probar). El dueño lo dejó «para más adelante» | Nada; no bloquea |
| E10 | **Un usuario de Chatwoot propio para el agente** (pasos en `AGENTE.md` §7). Al crearlo hay que cambiar el token de la credencial `Chatwoot Laundry VIP API` en n8n y el nombre «Byron ADMIN» en tres sitios del generador (`persona.cjs`, `seguimiento.cjs` y `seguimiento-barrido.ts`) | La regla de B1 y del seguimiento usa el nombre «Byron ADMIN» |
| E11 | Si Byron quiere usar el modo admin por WhatsApp, agregarse como Administrador en Configuración → lista blanca | Nada |

---

## 6. Lo temporal y la deuda que hay que conocer

- **Una sola base para pruebas y producción.** La suite crea y borra filas
  propias (`tests/util/corrida.ts`) y compara contra la base, pero cualquier
  prueba nueva puede tocar datos reales: respeta `DECISIONES.md` §3.
- **n8n, Chatwoot y la clave de OpenAI se comparten con 321.** Nada de 321 se
  toca. Lavandería VIP vive en la cuenta 3 de Chatwoot y en credenciales propias.
- **Las pruebas del prompt no existen:** el comportamiento del modelo no se
  puede probar con `vitest`. Lo que lo protege es el servidor (permisos,
  dirección obligatoria, guardia), las pruebas de emparejamiento y la
  auditoría con `pnpm chatwoot:revisar`.
- **El agente espera 30 s antes de contestar** (debounce). Es deliberado.
- Secretos: los rotó el dueño el 2026-09-23 (contraseñas, PIN, tokens). El
  historial de git está limpio (`tests/unit/sin-secretos.test.ts` lo vigila).

---

## 7. Mapa del código que más se toca

| Qué | Dónde |
|---|---|
| Acciones del agente (webhook) | `src/app/api/webhook/route.ts` · `src/server/webhook/schemas.ts` · `handlers/` (`cliente`, `logistica`, `pedidos`, `operador`, `planta`, `admin`, `reportes`, `permisos`, `index`) |
| Tope de mensajes, gasto y deduplicación | `src/server/webhook/rate-limit.ts`, `cost-tracking.ts` (conectados desde n8n, B2) |
| Motor de precios y emparejador | `src/server/pricing/cotizar.ts`, `linea.ts`, `normalizar.ts` |
| Horario, ventana, cobertura | `src/server/configuracion/` (`repo`, `horario`) · `src/server/scheduling/ventana.ts` |
| Crear pedido | `src/server/pedidos/crear.ts` |
| Radiografía para la dueña | `src/server/reportes/negocio.ts` · `handlers/admin.ts` |
| Dashboard y leads | `src/server/dashboard/` · `src/app/(dashboard)/page.tsx` |
| Catálogo y sinónimos (pantalla) | `src/app/(dashboard)/servicios/` · `src/components/servicios/` · `src/lib/sinonimos.ts` |
| Descargas CSV | `src/server/exportar/` · rutas `/clientes/exportar`, `/pedidos/exportar`, `/servicios/exportar` |
| Lista blanca y niveles | `src/components/configuracion/lista-blanca.tsx` · migraciones `0007`, `0008` |
| Enlaces a Chatwoot | `src/lib/chatwoot.ts` |
| Workflow n8n | `n8n/generador/*.cjs` → `n8n/workflows/laundry-vip-agente.json` · prompts en `n8n/*.md` |
| Catálogo inicial (solo carga en vacío) | `scripts/catalogo-datos.ts` · `scripts/db-seed.ts` |
| Pruebas | `tests/unit`, `tests/integration` (contra la base real), `tests/e2e` (Playwright) · utilidades en `tests/util/` |
