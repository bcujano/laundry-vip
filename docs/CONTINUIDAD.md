# Estado y continuidad

Última actualización: **2026-10-05** (cierre de sesión, verificado contra
producción ese mismo día; P1 y P2 hechos esa tarde). Es el primer archivo que se lee en cada sesión; está
escrito para arrancar **sin hacerle preguntas al dueño**. Mapa de documentos:

| Archivo | Para qué |
|---|---|
| **este** | Arranque, estado real, plan en orden y lo que espera al dueño |
| [`AGENTE.md`](AGENTE.md) | Cómo funciona el agente de WhatsApp y cómo se cambia (MCP de n8n) |
| [`INFORME_CUESTIONARIO_SOL.md`](INFORME_CUESTIONARIO_SOL.md) | El cuestionario de María Sol ya respondido (2026-10-09): qué cambia, choques con decisiones previas y plan por fases |
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
| Base | Supabase `cvdlslltevwxprdktmfu` (São Paulo), **solo de VIP** (sin tablas de 321). Pruebas y producción comparten esa base (decidido: seguir así). Migraciones `0001`–`0021` aplicadas |
| Agente | n8n `https://primary-production-ed243.up.railway.app` · workflow **`Bleb55WBKPfBdxVg`** «iAgente Laundry VIP» · **116 nodos** · activo · versión activa `e52f8fb8-6be9-4fb0-bb45-8efe38e90b1f` (2026-10-10; agente v3.1, prompt compacto, OpenAI principal y Gemini 3 Flash de respaldo; anteriores para volver: `a625f7c1…`, `dd349fa7…`). Ojo: el agente «(lab)» tiene un prompt compacto un poco anterior al de producción; no afecta a clientes |
| Chatwoot | `https://chatwoot-production-8564.up.railway.app` · **cuenta 3** · bandeja «Vip Laundry». El agente publica como **«Agente VIP»** (usuario 8). La cuenta 1 es de 321: **no se toca ni para leer** |
| WhatsApp | **+593 98 566 2822** · phone ID `1220603671147410` · WABA `1755486442349144` · app Meta «Laundry VIP» |
| Repo | `github.com/bcujano/laundry-vip` (privado) · rama `agente-n8n-laundry`, etiqueta `v1.0` (estado con el número de prueba). Local en `C:\dev\laundry-vip`. Historial reescrito el 2026-09-23 |
| Gate | typecheck, lint (sin advertencias), build y **363 pruebas** en verde · 10 E2E de Playwright (`pnpm test:e2e`, necesita `pnpm build` y el puerto 3000 libre) |
| Credenciales en n8n | `CRM Laundry VIP Webhook` (id `9456EHfb8yxpZOmr`), `Chatwoot Laundry VIP API` (token de «Agente VIP»), `Meta WhatsApp Laundry VIP`, `Postgres Laundry VIP`, `OpenAi account` (compartida con 321). Nunca en el JSON |
| Variables (`.env.local`) | Solo nombres: `SUPABASE_*`, `N8N_WEBHOOK_SECRET`, `CHATWOOT_*` (el token de ahí es el de Byron: no lo uses para publicar como agente), `WHATSAPP_*`, `OPENAI_API_KEY` (vacía a propósito: vive solo en n8n), `LOCAL_LATITUD/LONGITUD/DIRECCION` |
| Imagen del catálogo | `public/catalogo.png` → **https://laundry-vip.vercel.app/catalogo.png** (pública: está excluida del proxy de sesión). Es `vip5.png` de la carpeta de Drive del dueño (2026-09-24). **Es una foto fija: no sigue a Configuración.** Para cambiarla: reemplazar el archivo y `npx vercel --prod --yes` (n8n la descarga cada vez) |
| Conectores de esta sesión | Google Drive (`mcp__12076c00…`): `download_file_content` devuelve base64 en un archivo JSON; se decodifica con `node` |

**Personas:** Byron David (dueño, superadmin, `brncjn@gmail.com`) · **María Sol
Játiva** (administradora/dueña en la operación diaria, `+593 98 509 1860`; su
Chatwoot es el usuario 6) · Daniel Serrano (operador de planta, `+593 99 304 6212`).
Lista blanca de WhatsApp: María Sol (admin) y Daniel (operador). Byron **no** está
en ella: sus pruebas con el número de 321 entran como cliente.

**Configuración hoy (la edita el dueño en el CRM):** «VIP Laundry» · lunes a
sábado, local 9:00–19:00 (sábados hasta 17:00) · **recolección 9:00–17:00** ·
tarifa de recogida y entrega **$2,50** · entrega **por servicio** (agua 24 h, seco 72 h, alfombras 1 semana hábil; la edita Sol en Servicios, columna «Entrega») · recogida solo en
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
| `node n8n/generador/generar.cjs` | regenera el JSON del workflow (debe decir «OK: 116 nodos») |
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

**P1 · Catálogo en imagen al primer contacto — HECHO el 2026-10-05, falta verlo con un cliente real.**
La imagen es la del dueño (`vip5.png`, «Servicios y precios VIP», 1080×1920), servida por el CRM
(`public/catalogo.png`) y enviada por n8n como **adjunto de Chatwoot** (foto nativa, sin enlace):
`Enviar Respuesta Chatwoot` → `Primer Contacto?` → `Descargar Catalogo` → `Nombrar Catalogo` →
`Enviar Catalogo` (`n8n/generador/catalogo.cjs`). Primer contacto = nadie ha escrito aún en la
conversación y no es del equipo ni escalado. El prompt (Sección 1, punto 9) le dice al agente que la
lista llega sola. Publicado y verificado (`verificar-prompts` y `verificar-errores` en OK).
**Pendiente (P4):** con el **primer cliente nuevo** comprobar en Chatwoot/WhatsApp que llega **después
del primer mensaje del agente y se ve como foto, no como archivo**. Fabian Vilema (conversación 22,
2026-10-05 22:43Z) escribió minutos antes de publicar: **no la recibió**; no se le mandó a mano.
**Para el dueño sobre la imagen (E1):** (a) el cuadro dice «SERVICIO DE RECOGIDA Y ENTREGA» **sin
precio** (la tarifa es $2,50; la versión `vip6.png` sí lo trae, pero es un anuncio, no la lista);
(b) dice vestidos «de $6,00 a $25,50» y en el CRM el vestido corto cuesta $5,00; (c) como es foto fija,
si cambia un precio en el CRM hay que reemplazar la imagen. Los demás precios coinciden con la base.

**P2 · Pulido del tráfico real — HECHO el 2026-10-05** (cada punto con prueba en
`tests/unit/saludo-seguimiento.test.ts` y `workflow-pulido-p2.test.ts`; publicado en n8n):
- **F1** el saludo del seguimiento ahora corrige también «buen día», «buen mediodía», «buena tarde/noche»
  (`n8n/generador/saludo.cjs`, mismo patrón en el script de barrido).
- **F2** el prompt obliga a usar la cantidad que el cliente ya dijo («Tengo 3 ternos» + «Completos») y a
  preguntar solo el dato que falta. **Es comportamiento del modelo: sin prueba real hasta que pase otro
  caso igual** (revisar con `pnpm chatwoot:revisar`).
- **F3** el redactor del seguimiento recibe la conversación completa (`Armar Transcripcion`) y no ofrece
  recoger a quien ya oyó que su zona no tiene recogida; además se le prohibió el relleno
  («quedamos atentos», «estoy para ayudarle»). Igual: confirmar con el próximo seguimiento real.
- **F4** fuera de zona, una sola pregunta clara y nunca «agendar para que pase por su ropa».
- **F5** `Hay Conversacion?` antes de `Nota Aviso Manual`: un aviso sin chat solo se marca `requiere_persona`.

**P3 · Cuestionario de María Sol (en proceso con ella).** Cuando lo devuelva: cargar
los datos al CRM (precios, `sectores_cobertura`, horarios, plazos), escribir las reglas en
los prompts **como principios y no como plantillas**, convertir cada escenario en prueba
y construir las reglas de intervención aprobadas del **Anexo A** (`#bot`, `#venta`,
`#seguir`, vencimiento de la pausa a las 3 h hábiles, nota de traspaso, avisos por
WhatsApp, suplente). Decidir con ella si el agente debe crear el pedido de una venta
cerrada por chat (hoy solo avisa que falta). Sin ella respondida, nada de esto avanza.

**P4 · Confirmar con tráfico real lo que aún no se ha visto:** la foto del catálogo en el primer
contacto (P1) y los seguimientos con la conversación (F3); primer envío de la nota
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
- Los avisos que crean las pruebas los puede leer el flujo real de avisos (cada 5 min)
  mientras corre la suite y cambiarles el estado: por eso la prueba de avisos no depende del estado `pendiente` (usa `ventanaAbierta`, pura).
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
| E1 | **Imagen del catálogo:** decidir si se corrige (falta el precio de recogida y entrega; vestidos «desde $6» contra $5 del CRM). Hoy se usa `vip5.png` tal cual | Se mantiene `vip5.png`; para cambiarla basta reemplazar `public/catalogo.png` y desplegar |
| E8 | ~~Token de Meta inválido en n8n~~ **RESUELTO** (verificado 2026-10-11): el dueño corrigió la credencial «Meta WhatsApp Laundry VIP»; un aviso de prueba al +593963987124 salió por la plantilla `aviso_equipo` y Meta lo aceptó (wamid). Los avisos al equipo, a la dueña y el resumen de las 8:00 funcionan | — |
| E9 | ~~Plantilla de Meta `aviso_equipo`~~ **APROBADA** (verificado 2026-10-10 por la API: estado APPROVED, idioma es). Falta E8 para que se pueda usar | — |
| E10 | **Gemini como motor principal del agente de clientes (decisión del dueño, 2026-10-11: a nivel de n8n, de pago si hace falta, para el trato de Fagal).** Faltan dos cosas del dueño: (1) activar **facturación** en el proyecto de la llave de Gemini de Lavandería (hoy es capa gratis: 5 llamadas/minuto, `generate_content_free_tier_requests`); (2) en n8n → Credenciales → «Google Gemini(PaLM) Api» con esa llave, nombre «Gemini VIP Laundry» (no hay herramienta MCP para crear credenciales). Con eso, el cambio son 6 operaciones MCP: `setNodeCredential` en `Gemini Laundry`, `Gemini Operador` y `Gemini Lab`; `Gemini Laundry` como entrada 0 y `OpenAI Laundry` como entrada 1 del agente de clientes (`removeConnection`/`addConnection`, ver `n8n/generador/modelos.cjs` → `MOTOR_PRINCIPAL`); luego `verificar-prompts`, publicar y probar con `scripts/simular-cliente.ts`. La memoria del turno con respaldo ya está cubierta (nodo `Respaldar Memoria`) | Dueño (facturación + credencial) |
| E2 | ~~Plazo de entrega~~ **Resuelto el 2026-10-09** por María Sol en el cuestionario: 24 h agua / 72 h seco / 1 semana alfombras, desde que llega a planta | Hecho: columna `servicios.plazo_horas` (migración 0020); `cotizar_prendas` lo devuelve y el prompt lo usa. `horas_entrega_min/max` de Configuración quedan sin uso |
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
