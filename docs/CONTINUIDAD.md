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
| Base | Supabase `cvdlslltevwxprdktmfu` (São Paulo). **Una sola base: pruebas y producción comparten.** Migraciones `0001`–`0015` aplicadas |
| Agente | n8n `https://primary-production-ed243.up.railway.app` · workflow **`Bleb55WBKPfBdxVg`** «iAgente Laundry VIP» · 68 nodos · activo · versión activa `41b3784d-dc1c-463b-b5f0-3b5b22fe1ce4` (2026-09-30) |
| Chatwoot | `https://chatwoot-production-8564.up.railway.app` · **cuenta 3** · bandeja «Vip Laundry». La cuenta 1 es de 321: **no se toca ni para leer** |
| WhatsApp | **+593 98 566 2822** · phone ID `1220603671147410` · WABA `1755486442349144` · app Meta «Laundry VIP» |
| Repo | local, rama `agente-n8n-laundry`, etiqueta `v1.0` (estado con el número de prueba). Historial reescrito el 2026-09-23 (los SHA cambiaron). Remoto `github.com/bcujano/laundry-vip` configurado pero **el repositorio no existe en GitHub** |
| Gate | typecheck, lint, build y **283 pruebas** en verde · 10 E2E de Playwright (`pnpm test:e2e`, necesita `pnpm build` y el puerto 3000 libre) |
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
40/teléfono/día (**hoy no se aplica, ver §4 B2**) · tope de gasto OpenAI $5/día
(**hoy no se aplica**).

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
2. **Devolverle la palabra al agente con María Sol.** Su conversación
   (Chatwoot cuenta 3, **conversación 5**, teléfono de María Sol) tiene la
   etiqueta `humano` desde el 2026-09-22, cuando probó al agente escribiéndole
   «Mal servicio»: con esa etiqueta el agente **no le contesta**, su mensaje del
   23/09 («¿me atienden?») quedó sin respuesta y por eso el modo dueña nunca
   funcionó para ella. Quita **solo esa** etiqueta:
   ```bash
   # bash no carga .env.local solo, y el archivo puede traer \r de Windows:
   B=$(grep -m1 '^CHATWOOT_BASE_URL=' .env.local | cut -d= -f2- | tr -d '\r"')
   T=$(grep -m1 '^CHATWOOT_API_TOKEN=' .env.local | cut -d= -f2- | tr -d '\r"')
   curl -s -X POST "$B/api/v1/accounts/3/conversations/5/labels" \
     -H "api_access_token: $T" -H "Content-Type: application/json" -d '{"labels":[]}'
   ```
   La API **reemplaza** el conjunto de etiquetas y la 5 solo tiene `humano`.
   **No toques la conversación 12** (Cristian Verdezoto): ahí `humano` es
   correcto, el cliente pidió que lo dejaran en paz. Verifica con
   `pnpm chatwoot:revisar` que la 5 quedó sin etiquetas. **Plan B:** si sigue
   con `humano` (Chatwoot a veces ignora un arreglo vacío), no insistas por otras
   vías: pídele al dueño en el reporte final que la quite a mano
   (conversación 5 → etiquetas → quitar «humano»).
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

**B4 · Cobertura verificable — ESTRUCTURA HECHA (2026-09-30), INERTE hasta que el dueño dé la lista (E3).** Migración `0015` (`configuracion.sectores_cobertura text[]`, vacía), pantalla de Configuración con un sector por línea, `src/server/pedidos/cobertura.ts` (`verificarSector`, con el normalizador de precios), `crear_pedido` acepta `sector` y, con lista cargada, rechaza `FUERA_DE_COBERTURA` o pide el sector; el prompt y la tool de n8n ya lo mandan. Con la lista vacía todo se comporta como antes. **Cuando E3 llegue:** cargar los barrios en Configuración y probar un pedido real con un sector fuera de la lista.

**B5 · Validar la búsqueda de Chatwoot por teléfono** (`src/lib/chatwoot.ts`,
`/search?q=`): es lo que usan los botones «abrir en Chatwoot» del CRM. Pruébala
contra la cuenta 3 real, solo lectura, con un teléfono que ya tenga conversación.

**B6 · GitHub y CI** — cuando el repositorio exista (§5 E5): `git push -u origin
agente-n8n-laundry --tags`. `.github/workflows/ci.yml` ya existe; revisa que
corra el gate con las variables como *secrets*.

**B7 · Funcionalidad pendiente del CRM:** aviso automático al cliente cuando hay
discrepancia (hoy es manual) · pantalla para cerrar el mes de clientes
`consolidado_mensual` · `meta_referrals` para el referral de los anuncios
(ahora que hay número real; patrón en `n8n/referencia/Meta-Referral-Capture.json`).

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
| E1 | **El único pedido real está mal:** se agendó para hoy 30/09 cuando el cliente pidió mañana, con la dirección vacía y a nombre de «Juan», que el cliente nunca dijo (contacto «Jp»). Está en Pedidos del CRM (estado `nuevo`). Hay que llamar al cliente y corregirlo o cancelarlo | No lo toques: el estado y los montos de un pedido se resuelven solo en el CRM |
| E2 | **Plazo de entrega:** Configuración dice 48–72 h; María Sol a veces dice «48 h» y otras «24 a 48» | Se mantiene 48–72 h |
| E3 | **Lista de barrios/sectores dentro de los 2,5 km** (para B4) | Cobertura solo en el prompt, como hoy |
| E4 | **Plantilla de Meta `resumen_diario_admin`** (categoría Utilidad, idioma `es`, 7 variables) | Sin plantilla: el resumen de las 8:00 solo llega si la admin escribió al agente en las últimas 23 h. Que María Sol le escriba algo cada día antes de las 8:00 |
| E5 | **Crear el repositorio `bcujano/laundry-vip` en GitHub, privado y vacío** (aquí no hay `gh`) | Nada; B6 espera |
| E6 | **Archivar el workflow viejo `ksk8bnj19phzMJHU`** en n8n (el MCP lo bloqueó). Está apagado pero reclama la misma ruta `/webhook/laundry-vip`: si alguien lo enciende se roba los mensajes | Nada |
| E7 | **Borrar `Descargas\laundry-vip-respaldo-antes-de-limpiar-historial.bundle`**: es el historial viejo y **contiene la credencial de 321** | Nada |
| E8 | **Cuentas nuevas:** Supabase de producción, OpenAI propia con tope de gasto, n8n y Chatwoot propios | Nada; B8 espera |
| E9 | **Limpiar Chatwoot** (conversaciones de prueba; el contacto «321 Soluciones Inmobiliarias» es el número de 321 de Byron usado para probar). El dueño lo dejó «para más adelante» | Nada; no bloquea |
| E10 | **Un usuario de Chatwoot propio para el agente** (p. ej. «Agente VIP») con su token, y cambiar el token de la credencial `Chatwoot Laundry VIP API` en n8n. Hace limpia la regla de B1 | Regla por nombre de remitente (ver B1) |
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
