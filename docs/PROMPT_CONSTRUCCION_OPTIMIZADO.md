# Prompt de construcción optimizado — Lavandería VIP

Copia TODO lo que está debajo de la línea y pégalo como primer mensaje en una sesión nueva de Claude Code, parado en una carpeta vacía con nombre válido (minúsculas, sin espacios: `lavanderia-vip`). No necesita ningún archivo previo.

---

Construye **Lavandería VIP**: un CRM interno más el backend de un agente de IA en WhatsApp para una lavandería de barrio en La Kennedy, Quito.

Lee este mensaje completo antes de escribir una línea de código. El diseño ya está resuelto; lo que falta es ejecución.

## 0. Cómo quiero que trabajes

1. **Construye por fases, en el orden de la sección 12.** Una fase por vez. No empieces la siguiente hasta que la actual pase su gate.
2. **El gate de cada fase es literal**: `pnpm typecheck`, `pnpm lint` y las pruebas que nombra la fase, todo en verde. Una advertencia tolerada se vuelve permanente: no avances con advertencias.
3. **Escribe las pruebas de la fase dentro de la fase**, nunca "después". Una fase sin sus pruebas no está terminada.
4. **Un commit por fase**, con mensaje descriptivo del tipo `fase 3: autenticación y protección de rutas`.
5. **Al terminar cada fase, párate y dime**: qué construiste, qué salió del gate y qué decisiones tomaste. Espera mi visto bueno antes de seguir.
6. **Donde algo no esté especificado aquí**, toma la decisión más simple y consistente con el resto y dila en una línea, no me preguntes.
7. **Si una fase parece necesitar algo de la sección 11 (fuera de alcance), es un error de este documento**: detente y dímelo en vez de construirlo.
8. **Si un dato de este documento choca con la realidad** (una versión que ya no existe, una API que cambió), no lo arregles en silencio: dímelo, propón el reemplazo y sigue solo cuando te confirme.
9. **No inventes archivos de infraestructura que no te pedí.** Nada de Docker, nada de ORM, nada de librería de fechas.
10. **Máximo 300 líneas por archivo.** Si algo crece más, divídelo por responsabilidad.

## 1. Qué es y para quién

Dos piezas que operan juntas:

**El agente de WhatsApp** (número exclusivo), alimentado por pauta de Meta Ads con anuncios Click-to-WhatsApp. Capta clientes B2B —clínicas, restaurantes y hoteles a 5 km a la redonda—, cotiza ítem por ítem contra el catálogo real de la planta, agenda recolección y entrega, y **nunca inventa un precio ni una fecha**.

**El CRM**, para que el dueño y un operador de planta (1 persona, hasta 3 a futuro) gestionen pedidos, clientes, catálogo, configuración y reportes. Incluye a los clientes que llegan al local en persona, que el operador registra mandando una nota de voz al mismo número del agente.

Objetivo de negocio: subir la facturación combinando los dos canales sin perder ninguno. Esta es la primera instalación de una plantilla que después se revende a otros negocios de barrio: por eso catálogo, horarios, número del agente y lista blanca de operadores viven en base de datos, **nunca** en el código ni en el prompt.

## 2. Restricción no negociable

Infraestructura 100% independiente de cualquier otro sistema mío: proyecto Supabase propio, proyecto Vercel propio, instancia n8n propia, instancia Chatwoot propia, clave de OpenAI propia. Cero recursos compartidos, cero código copiado de otro repo mío.

## 3. Stack — versiones verificadas al 2026-09-13

| Capa | Elección | Versión |
|---|---|---|
| Runtime | Node.js | `>=24.0.0 <25` |
| Paquetes | pnpm | `12.4.1` |
| Framework | Next.js App Router | `16.3.5` |
| UI | React y React DOM | `19.3.0` |
| Lenguaje | TypeScript | `6.0.2` — NO 7.x, rompe herramientas de framework a esta fecha |
| Estilos | Tailwind CSS | `4.3.3` |
| Componentes | shadcn, copiados al repo, base Radix | CLI `4.16.0` |
| Datos | `@supabase/supabase-js` crudo, **sin ORM** | `^2.116.0` |
| Driver directo, solo scripts | `postgres` | `3.4.9` |
| Validación | `zod` | `4.4.3` |
| Lint y formato | Biome, único | `2.5.5` |
| Pruebas | Vitest | `^5.0.0` |
| E2E | Playwright | `1.62.0` |
| Scripts sueltos | tsx | `4.23.1` |
| Automatización | n8n autoalojado en Railway | `n8nio/n8n:2.38.7` |
| Mensajería | Chatwoot autoalojado en Railway + WhatsApp Business Cloud API | `chatwoot/chatwoot:v4.17.1-ce` |
| IA | OpenAI `gpt-4.1-mini` (chat) y `gpt-transcribe` (audio) | **NUNCA `whisper-1`**, tiene apagado programado |
| Fechas | `Intl` nativo | America/Guayaquil es UTC-5 fijo, sin DST: ninguna librería de fechas |
| Hosting | Vercel (CRM) + Railway (n8n, Chatwoot) | — |

Antes de fijar cada versión, **verifícala contra el registro real**. Si alguna cambió, aplica la regla 8 de la sección 0: dímelo, no la actualices por tu cuenta.

Detalle de configuración obligatorio: Biome necesita `css.parser.tailwindDirectives: true` para no marcar error en el CSS de Tailwind v4. Y en Next 16, la protección de rutas va en `src/proxy.ts`, no en `middleware.ts`.

Deliberadamente NO se usan: ningún ORM, el SDK de OpenAI dentro del CRM (n8n llama a OpenAI por HTTP directo), el CLI de Supabase, ninguna librería de fechas, ninguna capa de caché de cliente tipo react-query, ningún segundo proveedor de identidad.

## 4. Entorno y base de datos

**Un solo proyecto de Supabase**, llamado `lavanderia-vip`, que sirve para desarrollar y para correr las pruebas. Estamos en fase de pruebas: que las pruebas escriban y borren filas ahí es aceptable y esperado, no hay datos reales que perder. El día que entre el primer cliente real se creará un segundo proyecto para producción; hasta entonces, uno.

Variables de entorno, en `.env.local` (nunca se commitea; `.env.example` sí, con las llaves vacías):

| Variable | Requerida desde la fase |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | 1 |
| `SUPABASE_DB_URL` — conexión directa, NO el pooler | 2 |
| `TEST_DATABASE_URL` — hoy, la misma de arriba | 2 |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 3 |
| `N8N_WEBHOOK_SECRET` | 8 |
| `OPENAI_COST_ALERT_DAILY_USD` | 11 |
| `CRM_BASE_URL`, `OPENAI_API_KEY` | 12 |
| `CHATWOOT_BASE_URL`, `CHATWOOT_API_TOKEN`, `CHATWOOT_ACCOUNT_ID` | 13 |
| `WHATSAPP_CLOUD_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | 13 |

`src/lib/env.ts` valida con zod al arrancar y falla nombrando la variable que falta, nunca cae a un valor por defecto. **Exige cada variable solo a partir de la fase que la usa**, para no romper los gates de las fases anteriores.

Las migraciones son archivos SQL numerados en `supabase/migrations/NNNN_descripcion.sql`, aplicados por un script propio (`scripts/db-migrate.ts`) que lleva su registro en una tabla `schema_migrations`. **Una migración ya aplicada nunca se edita**: todo cambio es un archivo nuevo. La siembra (`scripts/db-seed.ts`) es idempotente por upsert sobre `(nombre_item, metodo)`.

## 5. Estructura y límites de capas

```
src/app/(auth)/            login y callback
src/app/(dashboard)/       las 7 pantallas del CRM, cada una con su actions.ts
src/app/api/health/        healthcheck
src/app/api/webhook/       el unico endpoint del agente
src/proxy.ts               proteccion de rutas (Next 16)
src/components/{ui,layout,pedidos}/
src/lib/{env,auth,format}.ts, src/lib/supabase/{admin,anon-server}.ts
src/server/pricing/cotizar.ts        motor de precios - fuente unica de verdad
src/server/scheduling/ventana.ts
src/server/{pedidos,clientes,servicios}/repo.ts
src/server/webhook/{schemas,rate-limit,cost-tracking}.ts + handlers/
src/types/database.ts      tipos escritos a mano de las 14 tablas
supabase/migrations/*.sql, scripts/*.ts, n8n/workflows/*.json, tests/{unit,integration,e2e}/
```

Límites que no se cruzan:

- `src/app/**` nunca importa `lib/supabase/admin.ts` directo: siempre a través de `src/server/**`.
- `src/server/**` nunca importa React ni nada de `src/components/**`.
- `src/server/webhook/**` nunca duplica lógica de precio: siempre llama a `server/pricing/cotizar.ts`.
- El alias `@/` apunta a `src/` en código de app y de pruebas. **`scripts/` nunca usa el alias**: importa por ruta relativa, porque tsx no resuelve los paths de tsconfig. Vitest tampoco los hereda: declara el alias explícitamente en `vitest.config.ts`.

## 6. Modelo de datos — 14 tablas

`staff` — `auth_user_id` (FK a `auth.users`), `nombre_completo`, `rol` (`dueno`|`operador`), `estado` (`activo`|`inactivo`).

`clientes` — `telefono` (E.164, unique), `nombre_contacto`, `nombre_negocio`, `tipo_negocio` (`clinica`|`restaurante`|`hotel`|`otro`|`particular`), `canal_origen` (`whatsapp_agente`|`presencial`|`referral_ads`), `modelo_facturacion` (`por_pedido`|`consolidado_mensual`), `saldo_acumulado`, `aviso_privacidad_enviado_en`.

`servicios` — `categoria`, `nombre_item`, `metodo`, `unidad` (`pieza`|`m2`|`kilo`|`libra`|`paquete`|`par`), `precio_min`/`precio_max` (iguales salvo los dos peluches), `cantidad_por_paquete`, `requiere_seleccion_metodo` (true SOLO en Camisa/blusa y Camiseta), `activo`. Índice único `(nombre_item, metodo)`.

`configuracion` — fila única: `nombre_negocio`, `saludo_agente`, `zona_horaria`, `dias_operacion` (int[]), `hora_recoleccion_inicio`/`_fin`, `tarifa_combo` (5.00), `limite_mensajes_diarios_por_telefono` (40), `limite_costo_diario_openai_usd` (5.00).

`operador_whitelist` — `telefono` (unique), `nombre`, `activo`.

`pedidos` — `cliente_id` (FK, on delete restrict), `canal` (`whatsapp_agente`|`presencial`), `estado`, `tipo_entrega` (`combo`|`a_la_carta`, null si presencial), `metodo_transporte_recoleccion`/`_entrega` (`app`|`propio_cliente`|`n_a`), `pago_recoleccion`/`_entrega` (`pagado`|`pendiente`|`n_a`), `pago_lavado` (`estimado`|`confirmado`|`pagado`|`pendiente`|`acumulado_mensual`), montos por tramo, `numero_fundas`, `vehiculo_sugerido` (`moto`|`auto`), `direccion_recoleccion`, ventana de recolección, `foto_pre_recoleccion_url`, `discrepancia_detectada`/`_motivo`.

**Los 10 valores de `estado`, exactos:** `nuevo`, `esperando_pago_para_recoleccion`, `recolectado`, `en_proceso`, `esperando_pago_para_entrega`, `listo_para_entrega`, `entregado`, `cancelado`, `recoleccion_fallida`, `discrepancia_detectada`. Constraint: si `canal='presencial'`, dirección, vehículo y fundas son null.

`pedido_items` — `origen` (`declarado`|`verificado`), `item_declarado_id` (self-FK, obligatorio si verificado), `servicio_id` (null si no reconocido), `descripcion`, `cantidad`, `metodo_elegido`, precios, `no_reconocido`.

`pedido_eventos` — `estado_anterior`/`_nuevo`, `actor` (`agente`|`operador`|`sistema`), `staff_id`, `motivo`.

`correcciones_cotizacion` — `monto_anterior`, `monto_corregido`, `motivo`, `corregido_por_staff_id`, `notificado_cliente`.

`conversaciones` — `telefono` (unique), `contexto` jsonb, `chatwoot_conversation_id`, `ultima_interaccion`.

`eventos_procesados` — `dedupe_key` unique (el `message_id` de Chatwoot), `tipo`, `payload`.

`mensajes_diarios` — PK `(telefono, fecha)`, `contador`.

`uso_openai_diario` — PK `fecha`, tokens, `costo_estimado_usd`, `alerta_enviada`.

`errores_agente` — `telefono`, `tipo_error`, `mensaje_error`, `payload_bruto`, `resuelto`.

Cascadas: `pedidos` 1:N `pedido_items` / `pedido_eventos` / `correcciones_cotizacion`, todas `on delete cascade`. `clientes` 1:N `pedidos` con `on delete restrict`: nunca se borra un cliente con historial. Índices en `pedidos(estado)`, `pedidos(ventana_recoleccion_inicio)`, `pedidos(cliente_id)`, `pedido_items(pedido_id)`, `pedido_eventos(pedido_id, created_at)`.

RLS habilitado en las 14 tablas, denegar por defecto. El `service_role`, usado solo desde el servidor, la evita por diseño de Supabase. Es defensa en profundidad, no el mecanismo principal de autorización.

## 7. La API — un solo endpoint

`POST /api/webhook`. Header `x-webhook-secret` comparado con `crypto.timingSafeEqual` contra `N8N_WEBHOOK_SECRET`; inválido responde `401` sin leer `accion` ni `parametros`. Envelope único: `{ok: true, data}` o `{ok: false, error: {code, message}}`, sin excepciones por acción. Cada acción tiene su schema zod de entrada y de salida. El CRM no tiene API REST: sus pantallas usan Server Actions directo contra `src/server/**`.

15 acciones despachadas por el campo `accion`: `registrar_evento_entrante`, `sincronizar_memoria_conversacion`, `verificar_whitelist_operador`, `find_or_create_client`, `cotizar_prendas`, `calcular_vehiculo`, `obtener_proxima_ventana`, `crear_pedido`, `consultar_estado_pedido`, `registrar_cliente_presencial`, `actualizar_registro`, `confirmar_pago`, `corregir_cotizacion`, `generar_reporte`, `consultar_pedido`.

**`cotizar_prendas`** — la pieza más delicada. Entrada: lista de `{descripcion, cantidad, metodo?}`. Por cada ítem, en este orden:

1. Busca en `servicios` por `nombre_item` más cercano, normalizado a minúsculas y sin tildes, solo filas `activo`.
2. Si esa fila o su grupo tiene `requiere_seleccion_metodo=true` y no vino `metodo`: devuelve `requiere_metodo: true` **sin precio**. Nunca asumas un método.
3. Si no hay coincidencia: `encontrado: false`, `nota: "a confirmar por el operador"`, **sin precio**. Nunca inventes uno.
4. Si `precio_min !== precio_max` (los dos peluches): `es_rango: true`, ambos límites, sin `subtotal`.
5. Toda respuesta viaja con `resumen.estado = "estimado_pendiente_verificacion"`.

Errores: lista vacía → `400` con `error.code = "ITEMS_VACIOS"`; `cantidad <= 0` → `400` con `"CANTIDAD_INVALIDA"`. No escribe nada: es lectura pura.

**`crear_pedido`** — combo: `monto_combo` = `configuracion.tarifa_combo` vigente, cubre ambos tramos. A la carta: cada tramo independiente; `propio_cliente` no bloquea nada, `app` calcula el costo real y ese tramo queda `pendiente`. Si algún tramo queda `app` + `pendiente`, el pedido nace en `esperando_pago_para_recoleccion`. **Excepción que manda sobre todo lo anterior**: si el cliente es `consolidado_mensual`, el pedido SIEMPRE nace en `nuevo`. Si `canal='presencial'`, ningún dato de logística. Crea el pedido, sus `pedido_items` declarados y el primer `pedido_eventos`. Errores: `cliente_id` inexistente → `404`; `items` vacío → `400`; `tipo_entrega` ausente con `canal='whatsapp_agente'` → `400`.

**`corregir_cotizacion`** — escribe siempre en `correcciones_cotizacion` con el monto vigente como `monto_anterior`, actualiza `pedidos.monto_confirmado_lavado`, marca `discrepancia_detectada=true` y deja el pedido congelado hasta que el cliente confirme o un operador cierre. Responde `notificar_cliente: true`: n8n notifica el motivo **antes** de pedir el pago. Errores: pedido inexistente → `404`; monto negativo → `400`.

## 8. Reglas de negocio — no las simplifiques

1. **Lista de prendas, no "fundas".** El cliente describe la ropa ("5 camisetas, 4 pantalones jean, 1 chaqueta de lana") y eso cotiza. El número de fundas es un dato aparte, solo para elegir vehículo: 1 funda = moto, más de 1 = auto. Nunca lo mezcles con la lista de prendas.
2. **Todo pedido del agente se cotiza como estimado.** El monto final del lavado se confirma cuando el operador cuenta las prendas en planta contra la lista declarada, ANTES de lavar.
3. **Discrepancia = bloqueo más notificación, nunca cobro silencioso.** Un conteo que no cuadra o un error de cotización marcan `discrepancia_detectada=true`, bloquean el avance del pedido y disparan notificación al cliente con monto final y motivo, antes de pedir el pago. El monto original del agente nunca se cobra si un humano lo corrigió.
4. **Dos tipos de entrega, elige el cliente.** Combo: 5.00 flat, la lavandería gestiona y paga ambos tramos y cobra ese flat sin importar el costo real. A la carta: por tramo, el cliente elige transporte propio (la lavandería no gestiona ni paga nada de ese tramo) o vía apps a su costo real. Puede salir más caro que el combo: es el trade-off aceptado. **El negocio nunca subsidia el flete.**
5. **Nunca se despacha un tramo "app" sin su pago confirmado**, ni recolección ni entrega. Puede pagar de inmediato o después, pero siempre antes de pedir ese vehículo. Excepción única: clientes `consolidado_mensual` nunca bloquean por pago individual.
6. **No existe API de despacho de courier en Ecuador.** El despacho es humano-confirmado: el sistema arma la solicitud, el operador la ejecuta en la app de Uber o con la mensajería local. Esto es la decisión, no un pendiente.
7. **El agente atiende 24/7** y siempre agenda dentro de una ventana operativa real. Nunca rechaza un mensaje por horario: ofrece la siguiente ventana válida.
8. **Confirmación explícita antes de crear cualquier pedido.** El agente repite el resumen completo —ítems, estimado marcado como pendiente de verificación, costo de transporte, opciones de entrega— y espera un sí antes de llamar `crear_pedido`.
9. **Registro presencial por voz.** El operador, con su número en la lista blanca, manda una nota de voz al mismo número del agente para registrar a un cliente que llegó al local: se transcribe, se extrae y se crea el pedido `canal=presencial`, sin dirección ni vehículo. Si algo salió mal, corrige por texto y el agente actualiza **el mismo registro**, sin duplicar.
10. **El modo operador es multimodal** (voz, texto, imagen) y puede registrar clientes presenciales, pedir reportes, consultar pedidos, confirmar pagos y corregir cotizaciones. **Nunca borra nada**: eliminar exige entrar al CRM.
11. **Aviso de privacidad** una sola vez por cliente nuevo, en el primer contacto (LOPDP Ecuador).
12. **Rate limiting**: tope diario de mensajes por teléfono, y alerta una sola vez por día si el costo acumulado de OpenAI supera el techo configurable.

## 9. El catálogo real — 54 filas exactas

Transcrito de la lista física de precios de la planta. Siémbralo tal cual: no lo redondees, no lo "limpies", no lo completes.

**Alfombras, por m²:** Pelo corto 7.00 · Pelo alto 8.00. **(2)**

**Lavado en seco, método único, por pieza:** Terno 3 piezas 8.50 · Terno 2 piezas 7.50 · Saco terno 3.75 · Pantalón terno 3.75 · Abrigo liviano o gabardina 5.50 · Abrigo pesado 7.50 · Chal 3.00 · Chaleco 3.50 · Chompa 5.50 · Chompa de cuero 8.00 · Falda corta 3.50 · Falda larga 4.50 · Mandil 4.00 · Mantel pequeño 3.50 · Mantel mediano 4.00 · Mantel grande 5.00 · Vestido corto 5.00 · Vestido largo de fiesta 7.00 · Vestido primera comunión 6.00 · Vestido de novia sencillo 20.50 · Vestido de novia con cola 25.50 · Enterizo 5.00 · Edredón, plumas o en seco, 8.00 · Tinturado 6.00. **(24)**

**Doble y triple método — los ÚNICOS que exigen preguntar el método:** Camisa o blusa — agua 2.25, seco 2.50, planchado 1.70 · Camiseta — agua 2.25, seco 2.50. **(5)**

**Ropa suelta sin catalogar, por libra:** lavado+secado+doblado 0.70 · solo lavado 0.35 · solo secado 0.35. **(3)**

**Cortinas, por kilo:** Visillos 3.00 · Pesadas 3.50. **(2)**

**Hogar y otros:** Pantalón no de terno 3.00 · Suéter de lana 2.50 · Gorro 2.50 · Bufanda 3.00 · Mochila pequeña 3.50 · Mochila grande 5.00 · Almohada 3.00 · Cojín 2.50 · Edredón 2 plazas 5.00 · Edredón 2½ plazas 6.00 · Edredón 3 plazas 7.00 · Duvet 5.00 · Cobijas pequeñas, paquete de 3, 12.00 · Juego sábanas más 2 fundas 5.00 · Zapatos deportivos, el par, 3.00 · Peluche grande 5.00 a 7.00 (rango) · Peluche mediano 3.00 · Peluche pequeño 1.00 a 2.50 (rango). **(18)**

2+24+5+3+2+18 = **54**. El script de siembra debe afirmar ese número y fallar si no cuadra.

## 10. El agente y el CRM

### El agente: dos modos, misma receta anti-alucinación

Ambos modos, sin excepción: `temperature: 0`, `top_p: 0.1`, `response_format: json_object` y **"Tool First"**: dos llamadas a OpenAI por turno. La primera decide `accion` y parámetros y **no redacta texto**. La segunda redacta la respuesta usando ÚNICAMENTE lo que devolvió `/api/webhook`. Nunca colapses esto en una sola llamada: así es como se elimina la invención de precios y fechas.

**Modo cliente** (número exclusivo, 24/7): responde FAQ del local y gestiona todo el flujo de recolección según la sección 8. Tono de usted, profesional, audiencia B2B. Usa el objeto `referral` de WhatsApp Cloud API, presente cuando el mensaje viene de un anuncio, para personalizar el saludo. `ESCALAR_HUMANO` con una **lista blanca cerrada de frases explícitas**, para que un "ok gracias" no dispare una escalación.

**Modo operador** (números en la lista blanca): multimodal, según la regla 10.

Un único archivo JSON de workflow con las dos ramas dentro. Nodos: webhook trigger de Chatwoot (`message_created`) → filtro de mensaje válido → debounce de unos 30 segundos → IF operador o cliente → buscar o crear cliente → cargar memoria → OpenAI planificar acción → llamada al webhook → OpenAI redactar respuesta → extraer respuesta con try/catch que nunca tumba el flujo y registra en `errores_agente` → IF acción a ejecutar → notificación dual de pedido nuevo (WhatsApp al operador más resaltado en Cola de hoy) → preparar solicitud de despacho solo si el tramo es "app" y ya está pagado → responder por Chatwoot → idempotencia por `dedupe_key`. Todo secreto es variable de entorno de la instancia de n8n, nunca literal en el JSON. Timeout de 30 segundos por llamada a OpenAI, sin reintento: si falla, mensaje de espera segura más `requiere_escalar_humano: true`.

### El CRM: pantallas

`/` Cola de hoy (inicio): pedidos con ventana de hoy, ordenados por hora, `nuevo` resaltado, estado vacío explícito con mensaje. `/pedidos`: lista paginada de 50, filtros por estado y canal. `/pedidos/[id]`: detalle, checklist de verificación de conteo, confirmar pago, corregir cotización, línea de tiempo. `/clientes`: lista, detalle e historial. `/servicios`: CRUD del catálogo, solo `dueno`. `/configuracion`: horarios, lista blanca, tarifa combo, solo `dueno`. `/reportes`: ingresos por período y tipo de negocio.

Todas son Server Components dinámicos (`export const dynamic = 'force-dynamic'`): un CRM de uso diario no debe cachear. Mutaciones por Server Actions, nunca `fetch` desde el cliente. Toda lista tiene sus tres estados: cargando, vacía con mensaje específico y error con opción de reintentar.

Autenticación: Supabase Auth con magic link, cuentas invitadas a mano desde el panel, **nunca autoregistro**. `verifyAuth()` devuelve null si el token es inválido, si no hay fila en `staff` o si el staff está `inactivo`, y nunca lanza. Roles: `dueno` puede todo; `operador` no puede editar catálogo ni Configuración, **rechazado en el servidor**, no solo ocultando el botón.

Diseño utilitario y denso: 2 o 3 personas lo usan horas al día, no es marketing. Primario `#0F5C4F`, fondo `#F8FAF9`, superficie `#FFFFFF`, borde `#D8E0DD`, texto `#0F1A17`, texto apagado `#5B6A65`, destructivo `#B3261E`, éxito `#1E7A46`. Tipografía Inter, cuerpo 14/20, títulos 24 peso 600. Espaciado base 4. Radio 6 en inputs y botones, 10 en tarjetas. Tablas compactas y confirmaciones que nombran la acción y el monto. WCAG 2.2 AA: todo operable por teclado, foco visible, errores en texto y no solo en color.

Seguridad: cabeceras `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin` en todas las rutas. Ningún secreto en el repo, en un log ni en el bundle del cliente. La única llave que cruza al navegador es la anon de Supabase.

## 11. Fuera de alcance v1 — no lo construyas aunque parezca fácil

Facturación electrónica SRI · despacho de courier automatizado por API · pasarela de pago en línea · roles más allá de dueño y operador, o SSO · POS de mostrador · geo-cercado automático del radio de 5 km · multi-tenencia o marca blanca · agrupar varias recolecciones en un viaje · servicio externo de seguimiento de errores · harness de evaluación del modelo contra la API real.

## 12. Plan de construcción — 14 fases

Cada fase: construye, escribe sus pruebas, corre el gate, haz el commit, repórtame y espera.

| # | Fase | Hecho cuando | Gate |
|---|---|---|---|
| 1 | `env.ts` con zod, los dos clientes de Supabase, `GET /api/health` | Sin `SUPABASE_URL` el arranque falla nombrándola; con todas, `/api/health` responde 200 `{"ok":true}` | typecheck, su prueba, `pnpm build` |
| 2 | Migraciones de las 14 tablas, siembra de las 54 filas, `types/database.ts` | Migrar dos veces aplica 2 y luego 0; la siembra deja 54 exactas; las 14 tablas responden; el índice único rechaza el duplicado; el borrado en cascada funciona | typecheck, prueba de esquema |
| 3 | Magic link, callback, `verifyAuth()`, `src/proxy.ts` | Anónimo en el panel termina en `/login`; token inválido devuelve null sin lanzar; staff `inactivo` se trata como no autenticado | typecheck, su prueba, build |
| 4 | Pantallas de Servicios y Clientes con sus repos y `format.ts` | Las 54 filas listadas por categoría; precio editado persiste; duplicado rechazado; un `operador` no puede editar precios; clientes pagina de a 50 y filtra por tipo | typecheck, lint, dos pruebas de integración |
| 5 | Configuración y `obtenerProximaVentana()` | La ventana siempre cae en el futuro, incluso llamándola a las 2am o en día no operativo; los teléfonos quedan en E.164 | typecheck, lint, su prueba |
| 6 | Cola de hoy, `pedidos/repo.ts`, barra lateral, lista de Pedidos | Ordena por hora y resalta los `nuevo`; estado vacío con mensaje; pagina de a 50; filtra por estado y canal; con canal presencial oculta dirección y vehículo | typecheck, lint, su prueba |
| 7 | Detalle de pedido: checklist de conteo, pago, corrección, `pedidos/estado.ts` | Conteo distinto marca discrepancia y NO avanza a `en_proceso`; conteo igual avanza solo; pago confirmado libera el despacho; corrección deja fila de auditoría y bloquea el avance | typecheck, lint, dos pruebas de integración |
| 8 | `cotizar.ts`, `route.ts` del webhook, schemas zod, handlers de cliente | "3 camisetas" sin método pide método sin precio; con agua da 6.75; ítem inexistente va sin precio y con la nota; `calcularVehiculo(1)`=moto y >1=auto; sin el secreto correcto responde 401 sin ejecutar nada | typecheck, lint, prueba del motor con los 6 casos |
| 9 | `crear_pedido` y `consultar_estado_pedido` | La matriz de pago se cumple; el cliente `consolidado_mensual` nunca nace esperando pago; el combo toma la tarifa vigente; la consulta devuelve el más reciente | typecheck, lint, su prueba |
| 10 | Acciones de operador | Presencial nace sin logística; `actualizar_registro` no duplica; `confirmar_pago` saca del estado de espera; el monto viejo nunca se vuelve a cobrar | typecheck, lint, su prueba |
| 11 | Reportes, rate limit, alerta de costo | El reporte agrupa por `tipo_negocio`; pasado el tope el siguiente mensaje se rechaza con un código identificable sin ejecutar la acción; la alerta se marca exactamente una vez por día; la búsqueda por nombre parcial es insensible a mayúsculas | typecheck, lint, su prueba |
| 12 | Workflow de n8n: las dos ramas, más `n8n/README.md` | El JSON contiene "Tool First", el trato de usted y la lista cerrada de escalación; los nodos de OpenAI declaran `temperature: 0`, `top_p: 0.1` y `json_object`; la transcripción usa `gpt-transcribe` y nunca `whisper-1`; la constitución de operador dice explícitamente que ese canal no borra | pruebas de contenido sobre el JSON |
| 13 | `check-integraciones-env.ts` y la doc de Chatwoot y WhatsApp | Con las 9 variables válidas sale 0; si falta una sale 1 y la nombra en stderr; la doc lista los pasos manuales marcados como checklist de lanzamiento | typecheck, su prueba |
| 14 | Cabeceras de seguridad, CI, doc de despliegue, E2E completo | Build en 0; el servidor construido responde 200 en `/api/health` con las dos cabeceras; toda la suite y los E2E en verde; el CI corre install → typecheck → lint → test → build deteniéndose en el primer fallo | build, smoke, `pnpm test`, `pnpm test:e2e` |

Las fases 8 a 11 solo dependen de la 2: si en algún momento quiero el agente antes que el panel, se pueden adelantar.

## 13. Qué se prueba y qué no

Unitario con Vitest: `env.ts`, `auth.ts`, el motor de precios, la ventana horaria y el contenido del JSON de n8n. Integración con Vitest contra Supabase real: rutas del webhook y Server Actions. E2E con Playwright, solo en la fase 14: redirección sin sesión, lista de pedidos sin errores de consola, confirmar pago sin recargar, y el camino de humo completo.

**Nunca** se prueba con llamadas reales a OpenAI, Chatwoot o WhatsApp: ningún gate puede depender de una cuenta externa viva. Del modelo se prueban los parámetros y el texto de la constitución, jamás el contenido que genera.

Empieza por la fase 1 y repórtame al terminarla.
