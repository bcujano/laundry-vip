# Estado y continuidad

Última actualización: **2026-10-05** (cierre de sesión, verificado contra
producción ese mismo día). Es el primer archivo que se lee en cada sesión; está
escrito para arrancar **sin hacerle preguntas al dueño**. Mapa de documentos:

| Archivo | Para qué |
|---|---|
| **este** | Arranque, estado real, plan en orden y lo que espera al dueño |
| [`AGENTE.md`](AGENTE.md) | Cómo funciona el agente de WhatsApp y cómo se cambia (MCP de n8n) |
| [`DECISIONES.md`](DECISIONES.md) | Lo que el dueño decidió (no revertir) y los fallos ya encontrados |
| [`Cuestionario_Conocimiento_del_Agente.pdf`](Cuestionario_Conocimiento_del_Agente.pdf) · `cuestionario/*.md` | Lo que María Sol debe transmitirle al agente (en proceso con ella). Se regenera con `python scripts/cuestionario_pdf.py` |
| [`CHATWOOT_Y_WHATSAPP.md`](CHATWOOT_Y_WHATSAPP.md) | De dónde sale cada credencial de integración |
| [`DESPLIEGUE.md`](DESPLIEGUE.md) | Despliegue del CRM |
| [`historia-agente.md`](historia-agente.md) | Por qué el agente nació clonado de 321 |
| `GUIA_CONSTRUCCION…`, `PLANO_PROYECTO`, `PROMPT_CONSTRUCCION…`, `CUESTIONARIO_OPERADOR…` | **Históricos de la construcción.** Traen valores viejos (combo, 5 km…): no son fuente de verdad |

---

## 0. Arranque

**Prompt para abrir la siguiente sesión** (el dueño lo pega tal cual):

> Continúo Lavandería VIP en `C:\dev\laundry-vip`, en producción con clientes
> reales (CRM https://laundry-vip.vercel.app · agente de WhatsApp en n8n,
> workflow `Bleb55WBKPfBdxVg` · número +593 98 566 2822). Lee `CLAUDE.md` y
> `docs/CONTINUIDAD.md` completos, y `docs/AGENTE.md` y `docs/DECISIONES.md`
> antes de tocar el agente. No me hagas preguntas: ejecuta la «§3 Acciones al
> arrancar», sigue con el «§4 Plan» en el orden escrito sin parar —empieza por
> **P1, el catálogo en imagen: la imagen la puse yo en Google Drive; búscala con
> el conector de Drive y haz que WhatsApp la entregue como foto nativa, sin
> enlaces ni generarla**— y al final reporta qué hiciste, qué verificaste contra
> el sistema real y qué quedó esperando algo mío (§5). Mi estilo: avanza de
> corrido, recomendaciones y no menús, **no cometas errores** (verifica contra
> producción), y nada de relleno ni plantillas en lo que el agente le dice al
> cliente. No toques nada de 321.

**Verificación en 1 minuto** de que todo sigue vivo:

```bash
curl -s https://laundry-vip.vercel.app/api/health
pnpm typecheck && pnpm lint && pnpm test
```

Y en n8n (MCP): `search_workflow_executions` sobre `Bleb55WBKPfBdxVg` con
`status: ["error","crashed"]`. El 2026-10-05 había **una** ejecución con error
(15:40Z del 1/10, un 404 de `Nota Aviso Manual` por un aviso de prueba sin
conversación; ya corregido, §6). Si aparecen más, investígalas. Si el MCP dice
«Workflow is not available in MCP», el dueño debe activarlo en la tarjeta del
workflow.

---

## 1. Dónde está cada cosa

| | |
|---|---|
| CRM | **https://laundry-vip.vercel.app** · Vercel `bcujanos-projects/laundry-vip` · deploy: `npx vercel --prod --yes` desde `C:\dev\laundry-vip` (el CLI ya tiene sesión) |
| Base | Supabase `cvdlslltevwxprdktmfu` (São Paulo), **solo de VIP** (sin tablas de 321). Pruebas y producción comparten esa base (decidido: seguir así). Migraciones `0001`–`0019` aplicadas |
| Agente | n8n `https://primary-production-ed243.up.railway.app` · workflow **`Bleb55WBKPfBdxVg`** «iAgente Laundry VIP» · **100 nodos** · activo · versión activa `921804f5-f3a0-4b70-b494-bbf07769db30` (2026-10-05) |
| Chatwoot | `https://chatwoot-production-8564.up.railway.app` · **cuenta 3** · bandeja «Vip Laundry». El agente publica como **«Agente VIP»** (usuario 8). La cuenta 1 es de 321: **no se toca ni para leer** |
| WhatsApp | **+593 98 566 2822** · phone ID `1220603671147410` · WABA `1755486442349144` · app Meta «Laundry VIP» |
| Repo | `github.com/bcujano/laundry-vip` (privado) · rama `agente-n8n-laundry`, etiqueta `v1.0` (estado con el número de prueba). Local en `C:\dev\laundry-vip`. Historial reescrito el 2026-09-23 |
| Gate | typecheck, lint (sin advertencias), build y **315 pruebas** en verde · 10 E2E de Playwright (`pnpm test:e2e`, necesita `pnpm build` y el puerto 3000 libre) |
| Credenciales en n8n | `CRM Laundry VIP Webhook` (id `9456EHfb8yxpZOmr`), `Chatwoot Laundry VIP API` (token de «Agente VIP»), `Meta WhatsApp Laundry VIP`, `Postgres Laundry VIP`, `OpenAi account` (compartida con 321). Nunca en el JSON |
| Variables (`.env.local`) | Solo nombres: `SUPABASE_*`, `N8N_WEBHOOK_SECRET`, `CHATWOOT_*` (el token de ahí es el de Byron: no lo uses para publicar como agente), `WHATSAPP_*`, `OPENAI_API_KEY` (vacía a propósito: vive solo en n8n), `LOCAL_LATITUD/LONGITUD/DIRECCION` |
| Conectores de esta sesión | Google Drive (`mcp__12076c00…`: buscar/leer/descargar archivos) para P1 |

**Personas:** Byron David (dueño, superadmin, `brncjn@gmail.com`) · **María Sol
Játiva** (administradora/dueña en la operación diaria, `+593 98 509 1860`; su
Chatwoot es el usuario 6) · Daniel Serrano (operador de planta, `+593 99 304 6212`).
Lista blanca de WhatsApp: María Sol (admin) y Daniel (operador). Byron **no** está
en ella: sus pruebas con el número de 321 entran como cliente.

**Configuración hoy (la edita el dueño en el CRM):** «VIP Laundry» · lunes a
sábado, local 9:00–19:00 (sábados hasta 17:00) · **recolección 9:00–17:00** ·
tarifa de recogida y entrega **$2,50** · entrega **48–72 h** · recogida solo en
**36 sectores** (≤2,5 km del local; el cliente nunca oye «2,5 km») · saludo «Bienvenido
a VIP Laundry, La Kennedy.» · seguimiento en modo **activo** · tope de mensajes
40/teléfono/día y de gasto OpenAI $5/día (ambos funcionan: ver §3).

**Datos hoy (2026-10-05):** 20 clientes, 21 conversaciones, **1 pedido** (el de
«Jp», defectuoso; el dueño dijo que lo olvidemos), 35 seguimientos, 0 avisos de
discrepancia, 0 errores del agente. Catálogo: 54 servicios con sinónimos.
`uso_openai_diario` marca ~$0,01–0,04 al día (estimado).

---

## 2. Comandos

| Comando | Para qué |
|---|---|
| `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` | el gate (los cuatro, siempre). Si `typecheck` se queja de `.next/types`, borra la carpeta `.next` |
| `pnpm chatwoot:revisar --desde AAAA-MM-DD [--salida f.txt]` | transcripciones del agente con clientes reales (solo lectura, cuenta 3) |
| `node n8n/generador/generar.cjs` | regenera el JSON del workflow (debe decir «OK: 100 nodos») |
| `node n8n/verificar-prompts.cjs <archivo>` | n8n idéntico al repo en los dos prompts |
| `node n8n/verificar-errores.cjs <archivo>` | los nodos de n8n conservan su «continuar si falla» (el MCP lo pierde al crear nodos) |
| `pnpm db:migrate` | aplica migraciones nuevas (nunca se edita una aplicada) |
| `pnpm db:seed` / `--forzar` | catálogo **solo si está vacío** / reimpone la lista (pisa al dueño) |
| `pnpm db:reset-clientes` / `--confirmar` | simula / **borra sin vuelta atrás** clientes, pedidos, conversaciones y memoria del agente |
| `pnpm db:staff` · `pnpm db:password <correo>` | cuentas del CRM |
| `pnpm check:integraciones` | las 9 variables de integración |
| `pnpm db:demo` | datos de ejemplo. **No los cargues sin permiso del dueño** |
| `pnpm tsx scripts/seguimiento-barrido.ts mensajes.json [--simular]` | manda ya un seguimiento a los teléfonos del archivo (orden del dueño del 30/09). Publica con el token de `.env.local`: ponle el de «Agente VIP» o su mensaje saldrá como de Byron y pausará el chat |
| `python scripts/cuestionario_pdf.py` | regenera el PDF del cuestionario |
| Webhook a mano | `curl -X POST https://laundry-vip.vercel.app/api/webhook -H "content-type: application/json" -H "x-webhook-secret: $N8N_WEBHOOK_SECRET" -d '{"accion":"verificar_cobertura","parametros":{"sector":"La Kennedy"}}'` |

`scripts/` no usa el alias `@/`. En este entorno, para escribir JSON/JS con
comillas y backticks usa la herramienta Write (un `heredoc` con `'` o `` ` ``
rompe el shell); y no uses `` ` `` dentro de `node -e "…"`.

---

## 3. Cómo está el sistema hoy (resumen verificado)

- **Agente de clientes** (`n8n/prompt-agente-laundry.md`, 6 tools): cotiza del
  catálogo, **verifica la cobertura por dentro** (`verificar_cobertura`, solo dice
  sí/no), **precio y plazo juntos** apenas el cliente dice qué quiere lavar, la
  **recogida y la entrega siempre en auto** (no pregunta fundas), saluda con el
  saludo de la casa, **directo y sin relleno** (principio, no plantilla), nunca niega
  un servicio, no inventa el nombre, no miente si le preguntan si es persona.
- **Persona manda:** si alguien que no es «Agente VIP» (María Sol, Daniel, Byron)
  escribe a mano, el chat queda con la etiqueta `humano` y el agente calla.
- **Protecciones con tráfico real (verificado):** `mensajes_diarios`,
  `eventos_procesados` y `uso_openai_diario` se llenan desde el 30/09; el tope de
  40 mensajes cuenta un mensaje por turno; el gasto es una estimación.
- **Seguimiento** (modo `activo`): 5 min, 1 h, 6 h y 23 h 30 min de silencio, solo
  dentro de las 24 h de WhatsApp y del horario del local; un paso atrasado sale
  en cuanto se puede (solo el más reciente). Antes de insistir lee la conversación:
  si ya compró/agendó/dijo que no, no insiste (y si compró, entra al CRM y deja una
  nota «falta crear el pedido»). Con el primer paso resume la conversación a María
  Sol (nota interna siempre; por WhatsApp solo si ella escribió al agente en las
  últimas 24 h, y hoy **no** lo ha hecho). El saludo del seguimiento lo corrige el
  código según la hora de Quito. Los 5 chats del barrido siguen sin el filtro
  «una persona ya contestó» (`seguimientos.barrido`).
- **Aviso de discrepancia** (excepción autorizada a la regla 10): si el conteo en
  planta no cuadra o se corrige un monto, el servidor arma un aviso fijo y n8n lo
  manda si la ventana de 24 h está abierta; si no, nota interna `requiere_persona`.
  **Nunca ha habido un caso real.**
- **Cuestionario para María Sol** entregado y **en proceso con ella**.

---

## 4. Acciones al arrancar (el dueño las autoriza al pegar el prompt)

1. **Verificación de 1 minuto** (§0). Si algo está rojo, arréglalo antes de seguir.
2. **Revisar lo que pasó con clientes reales** desde 2026-10-05:
   `pnpm chatwoot:revisar --desde 2026-10-05`. Busca lo de `DECISIONES.md` §2 y
   comprueba: que las respuestas del agente salen firmadas **«Agente VIP»**; que
   no suelta relleno ni el radio; que el seguimiento de 5 min llega y que María Sol
   recibió su nota (y el WhatsApp si ya le escribió al agente). **Cada falla:
   primero prueba, luego arreglo, luego verificación en producción.**
3. **Comprobar el resumen de las 8:00** solo si María Sol ya escribió al agente
   (`operador_whitelist.ultimo_mensaje_en` distinto de `null`); sin plantilla de
   Meta únicamente llega dentro de las 23 h siguientes a su último mensaje.

---

## 5. Plan de trabajo (en este orden, sin parar)

Cada punto termina con: gate verde → deploy → verificación contra producción →
commit y push → si tocó el agente, publicación en n8n + `verificar-prompts.cjs` +
`verificar-errores.cjs` → actualizar esta sección.

**P1 · Catálogo en imagen al primer contacto (lo pidió el dueño; se dejó listo
para esta sesión).** Qué quiere: que cuando alguien contacta por primera vez el
agente le mande la lista de precios **como imagen nativa de WhatsApp (foto), sin
enlaces**, y **no quiere que la genere el CRM**: la imagen es suya y la puso en
Google Drive («para que tú la conviertas en Google Fotos y uses ese URL»). Se
quitó el generador que había hecho (se desconectó porque no era lo pedido).
Plan recomendado:
1. Buscar la imagen con el conector de Drive (`search_files`, nombres como
   «catálogo»/«precios»; `download_file_content`). Si no aparece, pedírsela al
   dueño **una sola vez**.
2. **No hace falta Google Fotos**: sus enlaces compartidos no son imagen directa.
   Servir la imagen desde el propio CRM (`public/catalogo.png` → 
   `https://laundry-vip.vercel.app/catalogo.png`) y que n8n la descargue y la suba a
   Chatwoot como **adjunto**, que es lo que la manda a WhatsApp como foto nativa y la
   deja en el chat. (Si el dueño insiste en Fotos/Drive, un enlace directo
   `…/uc?export=download&id=…` de un archivo público también sirve como origen.)
3. La cadena ya está escrita y probada en su tramo de Chatwoot:
   `n8n/referencia/catalogo-en-imagen.cjs` (`Primer Contacto?` → `Descargar Catalogo` →
   `Nombrar Catalogo` → `Enviar Catalogo`, multipart con `attachments[]`, sin `content`:
   un `content` con paréntesis o acentos hizo que Chatwoot respondiera 400 por curl).
   Copiarla a `n8n/generador/`, poner `URL_CATALOGO`, requerirla en `generar.cjs`
   (después del bloque de avisos, **conectada** desde `Enviar Respuesta Chatwoot`),
   volver a poner en el prompt (Sección 1) la línea «la lista de precios llega sola:
   no la ofrezcas, no pegues enlaces ni recites el catálogo» y su prueba.
4. Publicar por MCP (**`addNode` pierde `onError`: correr `verificar-errores.cjs`**) y
   comprobar con el primer cliente nuevo real que en WhatsApp **se ve como foto** y no
   como archivo; si el dueño puede probar desde un número que no sea del equipo, mejor.

**P2 · Pulir lo que mostró el tráfico real (2026-10-05, conversaciones 26 y 27).**
Cada uno con prueba antes de arreglar:
- **F1** El seguimiento escribió «Buen mediodía» y «Buen día»: la guardia del saludo
  (`armar` en `n8n/generador/seguimiento.cjs` y el script de barrido) solo corrige
  «buenos días/tardes/noches». Ampliar a «buen día», «buen mediodía» y variantes.
- **F2** Un cliente escribió «Tengo 3 ternos» / «Completos» y el agente volvió a
  preguntar «¿cuántos ternos quiere lavar?» (ráfaga de dos mensajes; debía cotizar
  3 × $7,50 = $22,50). Revisar el prompt y el debounce de 7 s.
- **F3** Al cliente fuera de cobertura (Llano Grande) el seguimiento siguió
  ofreciéndole «¿agendamos la recogida?». Pasar la conversación completa al
  redactor del seguimiento (ya existe `Armar Transcripcion`) con la regla «si se le
  dijo que su zona no tiene recogida, solo ofrece traer la ropa».
- **F4** Tras «Por Llano Grande no recogemos, pero puede traer…» el agente preguntó
  «¿prefiere que le agende para que pase por su ropa…?», confuso: una pregunta clara.
- **F5** `Nota Aviso Manual` falla con 404 si el aviso no tiene conversación de
  Chatwoot (pasó con avisos de pruebas); añadir un IF que lo salte y marque
  `requiere_persona` directo.

**P3 · Cuestionario de María Sol (en proceso con ella).** Cuando lo devuelva: cargar
los datos al CRM (precios, `sectores_cobertura`, horarios, plazos), escribir las reglas en
los prompts **como principios y no como plantillas**, convertir cada escenario en prueba
y construir las reglas de intervención aprobadas del **Anexo A** (`#bot`, `#venta`,
`#seguir`, vencimiento de la pausa a las 3 h hábiles, nota de traspaso, avisos por
WhatsApp, suplente). Decidir con ella si el agente debe crear el pedido de una venta
cerrada por chat (hoy solo avisa que falta). Sin ella respondida, nada de esto avanza.

**P4 · Confirmar con tráfico real lo que aún no se ha visto:** primer envío de la nota
«Lead sin respuesta» a María Sol (y por WhatsApp si ya escribió al agente); primer aviso
de discrepancia real; primer pedido real creado por el agente con `sector` y vehículo
`auto`.

**P5 · Menores, cuando haya hueco:**
- `.github/workflows/ci.yml`: revisar que corra el gate con las variables como
  *secrets* (las pruebas de integración tocan la base real: **no** darles las llaves de
  producción).
- El botón «abrir en Chatwoot» de un cliente sin conversación (`/search?q=<dígitos>`) no
  se pudo probar en el navegador (pide sesión); `contacts/search` sí funciona por API.
- Deuda de tamaño (regla 2, 300 líneas): `tests/integration/webhook.test.ts` (~450) y
  `tests/integration/crear-pedido.test.ts` (~345) ya pasaban de 300 antes.
- **Pantalla de cierre de mes** de clientes `consolidado_mensual`: solo cuando exista el
  primer cliente con facturación mensual (explicado al dueño).
- **`meta_referrals`** (origen de los anuncios): el dueño lo dejó para más adelante
  (patrón en `n8n/referencia/Meta-Referral-Capture.json`).
- Plantilla de Meta para avisar fuera de las 24 h: **no hace falta** (el dueño dice que
  María Sol escribe todo el tiempo); lo que cae fuera de la ventana queda como nota interna.

---

## 6. Trampas conocidas (no las vuelvas a pagar)

- **El MCP de n8n pierde `onError` al crear nodos** (`addNode`): 27 nodos quedaron sin
  «continuar si falla» hasta el 2026-10-05. Tras cada publicación: `verificar-errores.cjs`.
- `update_workflow` acepta `versionName` de **80 caracteres** como máximo y hay que mandar
  el prompt **completo** en cada cambio (luego `verificar-prompts.cjs`).
- `next dev` reescribía `CLAUDE.md` con un bloque propio; ya está desactivado
  (`agentRules: false` en `next.config.ts`). Si reaparece, revierte con `git checkout CLAUDE.md`.
- Las pruebas **no pueden depender de fechas ni de datos reales**: una tenía escrita la fecha
  «2026-10-05» y otra contaba clientes por 5 dígitos que coincidieron con un teléfono real.
  Usa `tests/util/corrida.ts` y frases únicas en el nombre.
- Los avisos que crean las pruebas pueden ser vistos por el flujo real de avisos (cada 5 min)
  mientras corre la suite; son avisos sin conversación y solo generan ruido.
- Debounce del agente: **7 s** (se bajó a mano en n8n; el repo ya lo refleja). `Extraer JSON`
  en n8n difiere del generado solo en formato; la guardia anti-alucinación está.
- Una sola base para pruebas y producción; n8n, Chatwoot y la clave de OpenAI se comparten con
  321 (nada de 321 se toca). Las pruebas del comportamiento del modelo no existen: lo protege
  el servidor, las pruebas de emparejamiento y `pnpm chatwoot:revisar`.
- Secretos rotados por el dueño el 2026-09-23; el historial de git está limpio
  (`tests/unit/sin-secretos.test.ts` lo vigila).

---

## 7. Esperando al dueño (con lo que haces por defecto mientras tanto)

| # | Qué falta | Por defecto, sin preguntarle |
|---|---|---|
| E1 | **La imagen del catálogo en Google Drive** (la puso o la pondrá él) | Búscala con el conector de Drive; si no está, pídela una sola vez |
| E2 | **Plazo de entrega:** Configuración dice 48–72 h; María Sol a veces dice «48 h» y otras «24 a 48» | Se mantiene 48–72 h |
| E3 | **Cuestionario respondido por María Sol** y sus decisiones sobre el Anexo A | Nada; P3 espera |
| E4 | **María Sol debe escribirle algo al agente cada día** (su número de admin) para que el aviso de «lead sin respuesta» y el resumen de las 8:00 le lleguen por WhatsApp | Solo quedan las notas internas en Chatwoot |
| E5 | **Borrar `Descargas\laundry-vip-respaldo-antes-de-limpiar-historial.bundle`**: es el historial viejo y **contiene la credencial de 321** | Nada |
| E6 | **Limpiar Chatwoot** (conversaciones de prueba; el contacto «321 Soluciones Inmobiliarias» es el número de 321 de Byron usado para probar; hay notas privadas de prueba en la conversación 5). Lo dejó «para más adelante» | Nada; no bloquea |
| E7 | Si Byron quiere el modo admin por WhatsApp, agregarse como Administrador en Configuración → lista blanca | Nada |

**Cerrados por el dueño (no reabrir):** el pedido de «Jp» (olvidado); crear el repo de GitHub
(hecho); el workflow viejo `ksk8bnj19phzMJHU` (ya inactivo, sin versión activa; no se toca);
el usuario propio del agente en Chatwoot (hecho); la plantilla de Meta (no hace falta); el
Supabase de pruebas (se sigue como está); la lista de barrios (cargada); el límite geográfico
(se queda; la pauta de anuncios ya lo respeta).

---

## 8. Mapa del código que más se toca

| Qué | Dónde |
|---|---|
| Acciones del agente (webhook) | `src/app/api/webhook/route.ts` · `src/server/webhook/schemas.ts` · `handlers/` (`cliente`, `logistica`, `pedidos`, `operador`, `planta`, `admin`, `reportes`, `permisos`, `seguimiento`, `avisos`, `index`) |
| Tope de mensajes, gasto y deduplicación | `src/server/webhook/rate-limit.ts`, `cost-tracking.ts` |
| Motor de precios y emparejador | `src/server/pricing/cotizar.ts`, `linea.ts`, `normalizar.ts` |
| Horario, ventana, cobertura | `src/server/configuracion/` · `src/server/scheduling/ventana.ts` · `src/server/pedidos/cobertura.ts` |
| Crear pedido | `src/server/pedidos/crear.ts` (la cobertura la verifica el handler `pedidos.ts`) |
| Seguimiento (selección de a quién y qué paso) | `src/server/seguimiento/` (`elegir.ts` puro, `repo.ts`) · acciones `candidatos_seguimiento`, `registrar_seguimiento`, `registrar_conversion`, `admins_para_aviso` |
| Avisos de discrepancia | `src/server/avisos/` (`texto.ts`, `repo.ts`, `duenas.ts`) · se crean en `pedidos/verificacion.ts` y `cobros.ts` |
| Radiografía para la dueña | `src/server/reportes/negocio.ts` · `handlers/admin.ts` |
| Dashboard y leads | `src/server/dashboard/` · `src/app/(dashboard)/page.tsx` |
| Catálogo y sinónimos (pantalla) | `src/app/(dashboard)/servicios/` · `src/components/servicios/` · `src/lib/sinonimos.ts` |
| Configuración (pantalla) | `src/app/(dashboard)/configuracion/` · `src/components/configuracion/` |
| Descargas CSV | `src/server/exportar/` · rutas `/clientes/exportar`, `/pedidos/exportar`, `/servicios/exportar` |
| Enlaces a Chatwoot | `src/lib/chatwoot.ts` |
| Workflow n8n | `n8n/generador/*.cjs` (`generar`, `agente` [nombre del agente y hora de corte], `persona`, `protecciones`, `seguimiento*` [núcleo, conversión, dueña, común], `avisos`, `herramientas-cliente`, `operador`, `resumen`, `crm`, `guardia`) → `n8n/workflows/laundry-vip-agente.json` · prompts en `n8n/*.md` · referencias sin desplegar en `n8n/referencia/` |
| Catálogo inicial (solo carga en vacío) | `scripts/catalogo-datos.ts` · `scripts/db-seed.ts` |
| Pruebas | `tests/unit`, `tests/integration` (contra la base real), `tests/e2e` (Playwright) · utilidades en `tests/util/` (`corrida`, `catalogo`, `workflow`) |
