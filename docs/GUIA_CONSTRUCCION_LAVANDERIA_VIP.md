# Guía de construcción — Lavandería VIP

## Agente de WhatsApp + CRM · versión sin Docker · Supabase y Vercel definitivos

Este documento reemplaza al blueprint formal. Es la versión de trabajo: mismo diseño, mismas reglas de negocio, mismos precios, pero organizada para construirla conversando con Claude en lenguaje normal, sin la ceremonia del formato Architect y sin base de datos local con Docker.

Fecha: 15 de septiembre de 2026. Basado en el blueprint de Lavandería VIP del 13 de septiembre de 2026.

---

## Cómo usar este documento

Léelo una vez completo para tener el mapa. Después trabájalo así:

- La **Parte 1** (secciones 1 a 5) es la referencia de arranque: qué se construye, con qué, y cómo se prepara la máquina.
- La **Parte 2** (secciones 6 a 10) es la referencia del producto: datos, precios, reglas, pantallas y el agente.
- La **Parte 3** (sección 11) son los **14 encargos**. Cada uno trae el texto exacto que le pides a Claude y la forma de saber si quedó bien.
- La **Parte 4** (secciones 12 a 16) es el cierre: despliegue, seguridad, costos y la revisión antes de lanzar.

Regla de oro: **un encargo a la vez**. No se pasa al siguiente hasta que el anterior pase sus chequeos. Esa disciplina es la que evita terminar con un montón de código que nadie puede verificar.

---

## Qué cambió respecto al plan original

Cuatro cambios, y nada más:

| Antes | Ahora | Por qué |
|---|---|---|
| Base de datos de prueba local con Docker | Un solo proyecto de Supabase, el mismo para desarrollo y para pruebas | Elimina un programa pesado de tu máquina y las pruebas corren contra el mismo motor que va a producción |
| `docker-compose.yml` y los comandos `db:test:up` / `db:test:down` | Se eliminan | Ya no hay nada que levantar localmente |
| 18 pasos con etiquetas de control de versiones | 14 encargos en lenguaje natural | Menos ceremonia, mismo contenido y mismos criterios |
| Playwright instalado temprano | Se instala al final, en el encargo 14 | Ahorra una descarga grande durante casi todo el camino |

**Lo que NO cambió y no se negocia:** el catálogo de 54 precios, las 14 tablas, las 15 acciones del webhook, las reglas de pago, la regla de que el agente nunca inventa un precio, y las versiones exactas de cada librería.

### Un solo proyecto de Supabase, y qué implica

Durante la fase de pruebas hay **un solo proyecto de Supabase**, llamado `lavanderia-vip`, que sirve a la vez para desarrollar y para correr las pruebas. Las variables `SUPABASE_DB_URL` y `TEST_DATABASE_URL` apuntan a esa misma base.

Esto significa que **las pruebas escriben y borran filas de verdad en esa base**. Hoy no importa: no hay clientes ni pedidos reales todavía, solo datos de ensayo. Las 54 filas del catálogo se pueden volver a sembrar cuando quieras con `pnpm db:seed`, porque la siembra es idempotente.

**El día que entre el primer cliente real, esto cambia.** Ahí se crea un segundo proyecto de Supabase para producción, se apunta `TEST_DATABASE_URL` al de siempre y `SUPABASE_DB_URL` de producción al nuevo. Ese día es el encargo 14, el del despliegue, y está anotado ahí. Hasta entonces, un solo proyecto.

---

# PARTE 1 — Preparación

## 1. Qué estamos construyendo

Lavandería VIP es una lavandería de barrio en La Kennedy, Quito. Se construyen dos piezas que trabajan juntas.

**Pieza 1 — el agente de WhatsApp.** Atiende a los clientes que llegan por los anuncios de Meta (Click-to-WhatsApp). Cotiza ítem por ítem contra el catálogo real de precios, agenda la recolección y la entrega, y nunca inventa un precio ni una fecha. Apunta a clientes B2B a 5 km a la redonda: clínicas, restaurantes y hoteles.

**Pieza 2 — el CRM.** Un panel interno donde el dueño y el operador ven los pedidos del día, los clientes, el catálogo, la configuración y los reportes. Incluye a los clientes que llegan al local en persona, que el operador registra mandando una nota de voz al mismo número del agente.

El objetivo de negocio es subir la facturación con los dos canales a la vez, sin perder ninguno.

### Quién lo usa

| Persona | A qué entra | Cada cuánto |
|---|---|---|
| Byron (dueño) | Supervisa pedidos, corrige cotizaciones, revisa reportes y catálogo | Diario |
| Operador de planta (1, hasta 3 a futuro) | Cola de hoy, conteo de prendas, registro por voz, confirmar pagos | Todo el turno |
| Cliente B2B | Cotiza, agenda y da seguimiento por WhatsApp | Semanal a mensual |
| Cliente presencial | Deja su ropa en el local; nunca ve el CRM | Ocasional |

### Los seis objetivos de esta versión

1. El agente cotiza cualquier combinación del catálogo real de 54 filas, marca siempre la cotización como estimado hasta la verificación en planta, y agenda una ventana de recolección real, 24 horas al día.
2. Ningún transporte gestionado por la lavandería sale sin el pago de ese tramo confirmado, salvo clientes con facturación mensual consolidada.
3. El operador registra un cliente presencial completo con una nota de voz, sin tocar el CRM.
4. El dueño ve en un solo lugar, la Cola de hoy, todo lo agendado para hoy, venga de WhatsApp o del mostrador.
5. Cualquier discrepancia, de conteo o de cotización, congela el pedido hasta que una persona la resuelva, y el cliente siempre se entera del monto final antes de que se le cobre.
6. Catálogo, horarios, número de WhatsApp y lista de operadores viven en la base de datos, no en el código. Esto es lo que permite revender esta misma plantilla a otro negocio de barrio sin reescribir nada.

### Cómo se mide el éxito

| Métrica | Objetivo |
|---|---|
| Pedidos por canal, WhatsApp contra presencial | Los dos crecen mes a mes; ninguno cae a cero |
| Tasa de corrección de cotizaciones del agente | Menos del 10% de los pedidos que vienen del agente |
| Clientes B2B nuevos por tipo de negocio | Al menos una clínica, restaurante u hotel nuevo por mes durante seis meses |
| Costo de OpenAI | Nunca pasar el techo diario sin que salte la alerta |

---

## 2. Lo que NO se construye

Esta tabla es una cerca. Si un encargo parece necesitar algo de aquí, algo está mal: detente y avísame en vez de agrandar el alcance.

| No se construye | Por qué no ahora |
|---|---|
| Facturación electrónica SRI | El contador externo ya lo cubre; exige certificados y un flujo fiscal que no aporta a este build |
| Despacho automático de mensajería por API | No hay proveedor con API confirmada en Ecuador: Uber Direct cerrado, Cabify salió en 2023, Rappi no hace paquetería |
| Pasarela de pago en línea | Los pagos son transferencia y efectivo, confirmados por el operador; una pasarela agrega riesgo sin demanda validada |
| Roles más allá de dueño y operador, o inicio de sesión corporativo | Son dos o tres personas conocidas |
| Caja registradora en el mostrador | El registro presencial va por la nota de voz |
| Detección automática del radio de 5 km | El operador juzga la dirección en segundos; automatizarlo no cambia la decisión |
| Multi-negocio o marca blanca | Es el primer despliegue de una plantilla revendible, pero construirlo sin un segundo cliente real es prematuro |
| Agrupar varias recolecciones en un viaje | No tiene sentido con el volumen inicial |

---

## 3. Con qué se construye

Las versiones de esta tabla son exactas y fueron verificadas el 13 de septiembre de 2026. No se cambian por memoria ni por "la última versión".

| Capa | Elección | Versión exacta |
|---|---|---|
| Runtime | Node.js | `>=24.0.0 <25` |
| Gestor de paquetes | pnpm | `12.4.1` |
| Framework | Next.js con App Router | `16.3.5` |
| Librería de interfaz | React y React DOM | `19.3.0` |
| Estilos | Tailwind CSS | `4.3.3` |
| Componentes | shadcn, se copian al proyecto, no es dependencia | CLI `4.16.0`, base `radix` |
| Base de datos y autenticación | Supabase con `@supabase/supabase-js` crudo, sin ORM | `^2.116.0` |
| Driver directo, solo para los scripts | `postgres` | `3.4.9` |
| Validación de datos | `zod` | `4.4.3` |
| Lenguaje | TypeScript | `6.0.2` — NO 7.x, rompe herramientas a esta fecha |
| Lint y formato | Biome | `2.5.5` |
| Pruebas | Vitest | `^5.0.0` |
| Pruebas de navegador | Playwright | `1.62.0` |
| Ejecutar scripts sueltos | tsx | `4.23.1` |
| Automatización del agente | n8n autoalojado en Railway | imagen `n8nio/n8n:2.38.7` |
| Mensajería | Chatwoot autoalojado en Railway + WhatsApp Business Cloud API | imagen `chatwoot/chatwoot:v4.17.1-ce` |
| Inteligencia artificial | OpenAI: `gpt-4.1-mini` para chat, `gpt-transcribe` para notas de voz | nunca `whisper-1` |
| Hosting del CRM | Vercel | región sugerida `gru1`, São Paulo |
| Fechas y horas | `Intl` nativo, sin librería de fechas | Ecuador es UTC-5 fijo, sin horario de verano |

### Independencia total de tu otro sistema

Este proyecto no comparte absolutamente nada con `crm-321`, tu sistema de bienes raíces: proyecto de Supabase propio, proyecto de Vercel propio, instancia de n8n propia, instancia de Chatwoot propia, clave de OpenAI propia. Lo único en común es la cuenta de Railway, y solo para la factura.

De `crm-321` se copian **convenciones, nunca código ni credenciales**: el patrón de verificación de sesión, el secreto compartido en la cabecera `x-webhook-secret`, y la receta anti-invención del agente (`temperature: 0`, `top_p: 0.1`, respuesta en formato JSON y la regla "primero la herramienta, después la palabra").

---

## 4. Cuentas, variables y preparación

### Cuentas que necesitas

| Cuenta | Cuándo hace falta |
|---|---|
| Supabase, proyecto `lavanderia-vip` — el único | Encargo 1 |
| Supabase, un segundo proyecto para producción | Solo cuando haya clientes reales, encargo 14 |
| OpenAI con clave de API | Encargo 12 |
| Railway, servicio n8n | Encargo 12 |
| Railway, servicio Chatwoot | Encargo 13 |
| Meta for Developers, WhatsApp Business Cloud API | Encargo 13 |
| Vercel | Encargo 14 |

### Las 17 variables de entorno

Viven en `.env.local`, que **nunca** se sube al repositorio. La plantilla vacía es `.env.example`, que sí se sube.

| Variable | Para qué | Dónde se saca | Desde el encargo |
|---|---|---|---|
| `SUPABASE_URL` | Cliente de datos del servidor | Supabase, Settings, API | 1 |
| `SUPABASE_ANON_KEY` | Verificar el token de sesión | Supabase, Settings, API | 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso completo desde el servidor, secreta | Supabase, Settings, API | 1 |
| `NEXT_PUBLIC_SUPABASE_URL` | Formulario de login en el navegador | Supabase, Settings, API | 3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Formulario de login en el navegador | Supabase, Settings, API | 3 |
| `SUPABASE_DB_URL` | Conexión directa para migrar y sembrar, secreta | Supabase, Settings, Database, cadena URI | 2 |
| `TEST_DATABASE_URL` | La base contra la que corren las pruebas. Hoy, la misma de arriba | Supabase, Settings, Database | 2 |
| `N8N_WEBHOOK_SECRET` | Secreto compartido entre n8n y el CRM, secreta | La generas tú con `openssl rand -hex 32` | 8 |
| `CRM_BASE_URL` | URL pública del CRM, la usa n8n | Dominio de Vercel | 12 |
| `OPENAI_API_KEY` | Llamadas de n8n a OpenAI, secreta | platform.openai.com | 12 |
| `OPENAI_COST_ALERT_DAILY_USD` | Techo diario de gasto por defecto | Lo defines tú | 11 |
| `CHATWOOT_BASE_URL` | URL de tu Chatwoot | Railway | 13 |
| `CHATWOOT_API_TOKEN` | Token de Chatwoot, secreta | Chatwoot, Profile Settings | 13 |
| `CHATWOOT_ACCOUNT_ID` | Número de cuenta de Chatwoot | URL del panel de Chatwoot | 13 |
| `WHATSAPP_CLOUD_API_TOKEN` | Token de la app de Meta, secreta | developers.facebook.com | 13 |
| `WHATSAPP_PHONE_NUMBER_ID` | Id del número del agente | developers.facebook.com | 13 |
| `WHATSAPP_VERIFY_TOKEN` | Token de verificación del webhook de Meta, secreta | Lo inventas tú | 13 |

Regla: la aplicación exige una variable **solo a partir del encargo donde se usa**. Así ningún encargo anterior se rompe cuando llega el que sí la necesita.

### Antes del primer comando

1. Crea la carpeta `C:\iA Projects\lavanderia-vip`. Con guion, sin espacios y fuera de Google Drive: Drive intentaría sincronizar decenas de miles de archivos y puede dañar el repositorio.
2. Crea el proyecto de Supabase `lavanderia-vip`. Anota cuatro cosas: la URL, la clave anon, la clave service role y la cadena de conexión directa, la de "Connection string" en modo URI, **no** la del pooler.
3. En ese proyecto, invita por correo a las dos cuentas de staff desde Authentication. En este sistema nadie se registra solo.

---

## 5. El arranque

Se corre una sola vez, desde la carpeta vacía del proyecto. Cada línea debe terminar bien antes de pasar a la siguiente.

```
# 1) pnpm en la version exacta
corepack enable
corepack prepare pnpm@12.4.1 --activate
node -v          # debe decir v24.x

# 2) base del proyecto - la carpeta debe estar VACIA para este comando
pnpm create next-app@16.3.5 . --ts --app --tailwind --biome --src-dir --use-pnpm
pnpm approve-builds --all
pnpm install --frozen-lockfile

# 3) las versiones exactas de este proyecto, por encima de las del scaffold
pnpm add -D typescript@6.0.2 @biomejs/biome@2.5.5 vitest@^5.0.0 @playwright/test@1.62.0 tsx@4.23.1
pnpm add @supabase/supabase-js@^2.116.0 zod@4.4.3 postgres@3.4.9

# 4) componentes de interfaz
pnpm dlx shadcn@4.16.0 init --base radix --no-monorepo --yes
```

Después vienen tres ajustes de configuración:

- **`biome.json`**: activar el lector de directivas de Tailwind v4 (`css.parser.tailwindDirectives: true`) e ignorar las carpetas `blueprints/` y `n8n/`. Sin lo primero, el linter marca error en el CSS de Tailwind.
- **`tsconfig.json`**: excluir `node_modules`, `blueprints` y `n8n`.
- **`package.json`**: agregar los atajos de comandos de la tabla siguiente.

### Los atajos de comandos, versión sin Docker

| Atajo | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo en localhost:3000 |
| `pnpm build` | Compila para producción |
| `pnpm typecheck` | Revisa que no haya errores de tipos |
| `pnpm lint` y `pnpm lint:fix` | Revisa y corrige el estilo del código |
| `pnpm test` | Pruebas unitarias y de integración |
| `pnpm test:e2e` | Pruebas de navegador, solo desde el encargo 14 |
| `pnpm db:migrate` | Aplica las migraciones contra `SUPABASE_DB_URL` |
| `pnpm db:seed` | Siembra las 54 filas del catálogo |
| `pnpm db:test:migrate` | Migra contra `TEST_DATABASE_URL` |
| `pnpm db:test:seed` | Siembra contra `TEST_DATABASE_URL` |
| `pnpm validate:n8n` | Valida el archivo del workflow de n8n |
| `pnpm smoke:health` | Compila, arranca, prueba `/api/health` y apaga |

Ya no existen `db:test:up`, `db:test:down` ni `db:test:reset`. La siembra es idempotente: usa upsert sobre la clave única, así que correrla dos veces deja las mismas 54 filas, nunca 108.

### Traer los archivos que ya están escritos

El bundle trae piezas terminadas que no hay que volver a escribir: el esquema completo de la base de datos, los scripts de migración y siembra, el workflow de n8n con sus 22 nodos, la configuración de pruebas y las reglas del proyecto. Se copian a la raíz del proyecto después del scaffold: todo el contenido de `workspace/` **menos `docker-compose.yml`**, que ya no se usa.

Después de copiar quedan dos ediciones menores de texto: en `tests/setup.ts` el mensaje de error todavía menciona `pnpm db:test:up`, y en `CLAUDE.md` la tabla de comandos todavía lista los de Docker.

Por último: crear `.env.local` a partir de `.env.example` y llenar las claves de Supabase, luego `git init`, primer commit, `pnpm db:test:migrate` y `pnpm db:test:seed`. Si la migración y la siembra terminan bien, el arranque salió limpio y empieza el encargo 1.

# PARTE 2 — El producto

## 6. Los datos: 14 tablas

El esquema completo ya está escrito en `supabase/migrations/0001_core.sql` y `0002_transaccional.sql`. No se reescribe: se aplica y se verifica. Son 5 tablas en la primera migración y 9 en la segunda.

Regla permanente: **una migración ya aplicada nunca se edita**. Todo cambio de esquema es un archivo nuevo con el número siguiente.

### Las cinco tablas base

**`staff`** — las cuentas del CRM. Campos: `id`, `auth_user_id` (enlaza con la cuenta de Supabase), `nombre_completo`, `rol` (`dueno` u `operador`), `estado` (`activo` o `inactivo`). Un `staff` inactivo se trata como no autenticado, aunque su sesión siga siendo válida.

**`clientes`** — B2B y particulares. Campos clave: `telefono` (único, formato internacional, es la llave que une WhatsApp con el CRM), `nombre_contacto`, `nombre_negocio`, `tipo_negocio` (`clinica`, `restaurante`, `hotel`, `otro`, `particular`), `canal_origen` (`whatsapp_agente`, `presencial`, `referral_ads`), `modelo_facturacion` (`por_pedido` o `consolidado_mensual`), `saldo_acumulado`, `aviso_privacidad_enviado_en` y `notas`.

**`servicios`** — el catálogo, única fuente de verdad de precios. Campos: `categoria`, `nombre_item`, `metodo`, `unidad`, `precio_min`, `precio_max`, `cantidad_por_paquete`, `requiere_seleccion_metodo`, `activo`. Índice único sobre `(nombre_item, metodo)`.

**`configuracion`** — una sola fila, editable desde el CRM: nombre del negocio, saludo del agente, zona horaria, días de operación, horas de recolección, tarifa del combo (5.00 por defecto), tope de mensajes diarios por teléfono (40) y techo diario de gasto en OpenAI (5.00).

**`operador_whitelist`** — los números de WhatsApp autorizados a hablarle al agente en modo operador.

### Las nueve tablas de operación

**`pedidos`** — un pedido es una recolección y entrega, o una visita presencial. Los campos que mandan:

| Campo | Valores | Para qué |
|---|---|---|
| `canal` | `whatsapp_agente`, `presencial` | De dónde vino |
| `estado` | 10 valores, de `nuevo` a `entregado`, más `cancelado`, `recoleccion_fallida` y `discrepancia_detectada` | Dónde va el pedido |
| `tipo_entrega` | `combo`, `a_la_carta` | Nulo si es presencial |
| `metodo_transporte_recoleccion` y `_entrega` | `app`, `propio_cliente`, `n_a` | Quién mueve la ropa |
| `pago_recoleccion` y `pago_entrega` | `pagado`, `pendiente`, `n_a` | Si el tramo está pagado |
| `pago_lavado` | `estimado`, `confirmado`, `pagado`, `pendiente`, `acumulado_mensual` | Estado del cobro del lavado |
| montos | estimado, confirmado, combo, transporte de ida y de vuelta | El dinero |
| `numero_fundas` | entero | Solo sirve para elegir vehículo, nunca se mezcla con los ítems |
| `vehiculo_sugerido` | `moto`, `auto` | 1 funda es moto, más de 1 es auto |
| ventana y dirección | fechas y texto | Nulas si es presencial |
| `discrepancia_detectada` y `discrepancia_motivo` | booleano y texto | El freno de mano del pedido |

Una restricción de la base impide que un pedido presencial tenga dirección, vehículo o fundas.

**`pedido_items`** — guarda dos listas: la declarada por el cliente (`origen = declarado`) y la verificada en planta (`origen = verificado`, enlazada a la declarada). Un ítem que no está en el catálogo se marca `no_reconocido` y va sin precio, con la nota "a confirmar por el operador".

**`pedido_eventos`** — la línea de tiempo: estado anterior, estado nuevo, quién lo hizo (`agente`, `operador`, `sistema`) y el motivo.

**`correcciones_cotizacion`** — la auditoría de cada corrección de monto: monto anterior, monto corregido, motivo, quién corrigió y si se notificó al cliente.

**`conversaciones`** — la memoria del agente por número de teléfono.

**`eventos_procesados`** — el libro de mensajes ya atendidos, para no procesar dos veces el mismo mensaje de WhatsApp.

**`mensajes_diarios`** — el contador por teléfono y por día, contra el abuso.

**`uso_openai_diario`** — tokens y costo estimado del día, y si ya se envió la alerta.

**`errores_agente`** — el registro de cuando el agente no logra entender su propia respuesta, para poder revisarlo después.

### Relaciones e índices

- Un cliente tiene muchos pedidos, y **nunca se puede borrar un cliente que tenga historial**.
- Un pedido tiene muchos ítems, muchos eventos y muchas correcciones; si se borra el pedido, se borra todo eso con él.
- Índices: `servicios` por `(nombre_item, metodo)`; `pedidos` por estado, por inicio de ventana y por cliente; `pedido_items` por pedido; `pedido_eventos` por pedido y fecha.

---

## 7. El catálogo real — 54 filas

Transcrito de la lista física de precios de la planta. No se inventa ni se redondea ninguna fila. Este es el contenido que siembra `pnpm db:seed`.

### A.1 Alfombras, por metro cuadrado — 2 filas

| Ítem | Precio |
|---|---|
| Pelo corto | 7.00 |
| Pelo alto | 8.00 |

### A.2 Lavado en seco, por pieza, método único — 24 filas

| Ítem | Precio | Ítem | Precio |
|---|---|---|---|
| Terno 3 piezas | 8.50 | Vestido corto | 5.00 |
| Terno 2 piezas | 7.50 | Vestido largo de fiesta | 7.00 |
| Saco de terno | 3.75 | Vestido primera comunión | 6.00 |
| Pantalón de terno | 3.75 | Vestido de novia sencillo | 20.50 |
| Abrigo liviano o gabardina | 5.50 | Vestido de novia con cola | 25.50 |
| Abrigo pesado | 7.50 | Enterizo | 5.00 |
| Chal | 3.00 | Edredón, plumas o en seco | 8.00 |
| Chaleco | 3.50 | Tinturado | 6.00 |
| Chompa | 5.50 | Mandil | 4.00 |
| Chompa de cuero | 8.00 | Mantel pequeño | 3.50 |
| Falda corta | 3.50 | Mantel mediano | 4.00 |
| Falda larga | 4.50 | Mantel grande | 5.00 |

### A.3 Doble y triple método — 5 filas

Estas son las **únicas** filas donde el agente debe preguntar el método antes de cotizar.

| Ítem | Método | Precio |
|---|---|---|
| Camisa o blusa | agua | 2.25 |
| Camisa o blusa | seco | 2.50 |
| Camisa o blusa | planchado | 1.70 |
| Camiseta | agua | 2.25 |
| Camiseta | seco | 2.50 |

### A.4 Ropa suelta sin catalogar, por libra — 3 filas

| Servicio | Precio |
|---|---|
| Lavado, secado y doblado | 0.70 |
| Solo lavado | 0.35 |
| Solo secado | 0.35 |

### A.5 Cortinas, por kilo — 2 filas

| Ítem | Precio |
|---|---|
| Visillos | 3.00 |
| Pesadas | 3.50 |

### A.6 Hogar y otros — 18 filas

| Ítem | Precio | Ítem | Precio |
|---|---|---|---|
| Pantalón, no de terno | 3.00 | Edredón 2 plazas | 5.00 |
| Suéter de lana | 2.50 | Edredón 2 plazas y media | 6.00 |
| Gorro | 2.50 | Edredón 3 plazas | 7.00 |
| Bufanda | 3.00 | Duvet | 5.00 |
| Mochila pequeña | 3.50 | Cobijas pequeñas, paquete de 3 | 12.00 |
| Mochila grande | 5.00 | Juego de sábanas con 2 fundas | 5.00 |
| Almohada | 3.00 | Zapatos deportivos, el par | 3.00 |
| Cojín | 2.50 | Peluche grande | 5.00 a 7.00 |
| Peluche mediano | 3.00 | Peluche pequeño | 1.00 a 2.50 |

Suma: 2 + 24 + 5 + 3 + 2 + 18 = **54 filas**. Este número aparece en el esquema, en la siembra y en las pruebas. Si alguna vez no cuadra, algo se rompió.

Los dos peluches son los únicos con rango de precio: se devuelven los dos límites y el subtotal se confirma en planta.

---

## 8. Las reglas de negocio que no se negocian

Estas ocho reglas son el corazón del proyecto. Cada una está implementada en el código del servidor, nunca en el texto del prompt del agente.

1. **El precio siempre sale de la tabla `servicios`.** El modelo de lenguaje jamás calcula ni estima un precio. Si un ítem no está en el catálogo, se marca como no reconocido y va con la nota "a confirmar por el operador". Jamás con un precio inventado.
2. **Toda cotización es un estimado** hasta que se verifica el conteo en planta. La respuesta del agente siempre lo dice.
3. **Ningún tramo de transporte gestionado por la lavandería sale sin su pago confirmado.** La única excepción son los clientes con facturación mensual consolidada, cuyos pedidos siempre nacen en estado `nuevo`.
4. **Una discrepancia congela el pedido.** Si el conteo verificado no coincide con el declarado, o si se corrige una cotización, el pedido se marca con discrepancia y no avanza de estado hasta que una persona lo resuelva.
5. **El monto original nunca se cobra después de una corrección.** Cada corrección deja su rastro en la tabla de auditoría, y el cliente se entera del motivo antes de que se le pida el pago.
6. **El vehículo es una regla, no una opinión**: una funda es moto, más de una es auto.
7. **El método solo se pregunta en las cinco filas que lo exigen** (camisa, blusa y camiseta). En el resto del catálogo, preguntarlo sería ruido.
8. **Nadie se registra solo.** Las cuentas del CRM se crean a mano desde el panel de Supabase.

---

## 9. El webhook: la única puerta del agente

n8n nunca toca la base de datos. Todo pasa por un solo endpoint del CRM: `POST /api/webhook`.

- **Autenticación**: cabecera `x-webhook-secret`, comparada de forma segura contra `N8N_WEBHOOK_SECRET`. Un secreto inválido responde 401 sin siquiera leer qué acción pedía.
- **Respuesta**: siempre la misma forma. En éxito `{ ok: true, data: ... }`, en error `{ ok: false, error: { code, message } }`.
- **Validación**: cada acción tiene su propio esquema de entrada y de salida con zod. Ninguna acción confía en el JSON crudo del modelo.
- **Sin repetidos**: cada mensaje entrante se registra con una llave única; si llega dos veces, se procesa una sola.

### Las 15 acciones

| Acción | Qué hace | Encargo |
|---|---|---|
| `registrar_evento_entrante` | Evita procesar el mismo mensaje dos veces | 8 |
| `sincronizar_memoria_conversacion` | Lee y actualiza la memoria del número | 8 |
| `verificar_whitelist_operador` | Dice si ese teléfono es un operador | 8 |
| `find_or_create_client` | Busca o crea el cliente por teléfono | 8 |
| `cotizar_prendas` | El motor de precios | 8 |
| `calcular_vehiculo` | Moto o auto según las fundas | 8 |
| `obtener_proxima_ventana` | La próxima ventana real de recolección | 8 |
| `crear_pedido` | Solo después de que el cliente confirma | 9 |
| `consultar_estado_pedido` | El pedido más reciente de ese teléfono | 9 |
| `registrar_cliente_presencial` | Pedido de mostrador, sin logística | 10 |
| `actualizar_registro` | Corrige un registro recién creado por voz | 10 |
| `confirmar_pago` | Marca pagado un tramo | 10 |
| `corregir_cotizacion` | Corrige el monto de cualquier pedido | 10 |
| `generar_reporte` | Ingresos por período y tipo de negocio | 11 |
| `consultar_pedido` | Busca por nombre, teléfono o id | 11 |

### `cotizar_prendas` en detalle

Recibe una lista de ítems con descripción, cantidad y método opcional. Por cada ítem hace esto, en este orden:

1. Busca en el catálogo por nombre normalizado, en minúsculas y sin tildes, entre las filas activas.
2. Si esa fila exige método y la petición no lo trae, responde `requiere_metodo: true` **sin precio**. Nunca asume el método.
3. Si no encuentra nada, responde `encontrado: false` con la nota "a confirmar por el operador", **sin precio**.
4. Si el precio es un rango, devuelve los dos límites y omite el subtotal.
5. El total siempre viaja marcado como estimado pendiente de verificación.

Errores: lista vacía devuelve `ITEMS_VACIOS`; una cantidad de cero o negativa devuelve `CANTIDAD_INVALIDA`. No crea ni modifica nada: es solo lectura.

### `crear_pedido` en detalle

1. Si es combo, el monto del combo sale de la configuración vigente y los dos tramos se pagan juntos.
2. Si es a la carta, cada tramo es independiente: si lo mueve el cliente, no bloquea nada; si lo mueve la lavandería, ese tramo queda pendiente de pago.
3. Si algún tramo queda pendiente de pago, el pedido nace esperando ese pago.
4. **Excepción que manda sobre todo lo anterior**: si el cliente es de facturación mensual consolidada, el pedido siempre nace en `nuevo`.
5. Si es presencial, no se llena ningún dato de dirección ni de vehículo.

Crea el pedido, sus ítems declarados y el primer evento de la línea de tiempo.

### `corregir_cotizacion` en detalle

Escribe siempre una fila de auditoría con el monto anterior, actualiza el monto confirmado, marca la discrepancia y deja el pedido congelado. La respuesta le ordena a n8n notificar al cliente con el motivo **antes** de pedirle el pago.

---

## 10. El CRM y el agente

### Las nueve pantallas

| Ruta | Pantalla | Quién entra |
|---|---|---|
| `/login` | Formulario de enlace mágico | Pública |
| `/` | Cola de hoy | Staff |
| `/pedidos` | Lista con filtros y paginación | Staff |
| `/pedidos/[id]` | Detalle, verificación de conteo y acciones | Staff |
| `/clientes` | Lista con filtro por tipo de negocio | Staff |
| `/clientes/[id]` | Detalle e historial | Staff |
| `/servicios` | El catálogo editable | Staff, editar solo el dueño |
| `/configuracion` | Horarios, operadores, tarifa | Solo el dueño |
| `/reportes` | Ingresos por período y tipo de negocio | Solo el dueño |

Todas las pantallas del panel se arman en el servidor y se piden frescas en cada visita: es un CRM que cambia todo el día, y un operador con una Cola de hoy vieja es peor que no tener pantalla. Las modificaciones se hacen con acciones de servidor, nunca con llamadas desde el navegador.

Toda lista tiene sus tres estados explícitos: cargando, vacía con un mensaje específico ("Sin pedidos programados para hoy", nunca una tabla en blanco) y con error, ofreciendo reintentar.

### Autenticación y permisos

Entrada por **enlace mágico**: el usuario escribe su correo, recibe un enlace y con eso entra. Sin contraseñas que resetear. La sesión vive en cookies seguras que el navegador no puede leer.

| Rol | Puede | No puede |
|---|---|---|
| `dueno` | Todo | — |
| `operador` | Ver Cola de hoy, Pedidos y Clientes; confirmar pagos; corregir cotizaciones; verificar conteo | Editar el catálogo de precios ni la Configuración |

El permiso se revisa en el servidor en cada petición. Ninguna pantalla confía en que el usuario no escriba la URL a mano.

### El aspecto: utilitario y denso

No es una página de marketing, es una herramienta que dos personas usan ocho horas al día.

| Color | Claro | Oscuro | Uso |
|---|---|---|---|
| Primario | `#0F5C4F` | `#3FBFA0` | Botones, enlaces, foco |
| Fondo | `#F8FAF9` | `#0B1412` | Fondo de página |
| Superficie | `#FFFFFF` | `#101B18` | Tarjetas, tablas, modales |
| Borde | `#D8E0DD` | `#233631` | Divisores |
| Texto | `#0F1A17` | `#E7F3EF` | Cuerpo |
| Texto apagado | `#5B6A65` | `#93A6A0` | Metadatos |
| Destructivo | `#B3261E` | `#FF6B60` | Errores, cancelar |
| Éxito | `#1E7A46` | `#4AD188` | Pago confirmado, entregado |

Tipografía Inter: cuerpo de 14 sobre 20, subtítulos de 18, títulos de 24 en peso 600. Espaciado en múltiplos de 4. Esquinas de 6 puntos en botones e inputs, 10 en tarjetas. Sin sombras salvo en modales. Ancho máximo de contenido 1280. Todo debe funcionar con teclado y cumplir contraste AA.

### Cómo funciona el agente

El flujo, de punta a punta: **WhatsApp → Chatwoot → n8n → el webhook del CRM → n8n → Chatwoot → WhatsApp**.

Dentro de n8n hay un solo workflow con 22 nodos y dos ramas: si el número está en la lista blanca, es el operador; si no, es un cliente. El archivo ya está escrito y versionado en `n8n/workflows/agente-lavanderia-vip.json`.

El patrón clave se llama **"primero la herramienta, después la palabra"**: son dos llamadas al modelo por mensaje. La primera decide qué herramienta usar y con qué parámetros. Se ejecuta la herramienta contra el CRM, que devuelve datos reales. La segunda llamada solo redacta la respuesta con esos datos en la mano. El modelo nunca tiene la oportunidad de inventar un número.

Las dos llamadas usan `temperature: 0`, `top_p: 0.1` y respuesta en formato JSON. Los dos prompts, llamados "constitución cliente" y "constitución operador", viven dentro del propio archivo del workflow, no en un archivo suelto que se pueda desincronizar.

Las notas de voz del operador se transcriben con `gpt-transcribe`. Nunca con `whisper-1`, que se apaga en febrero de 2027.

Si una llamada a OpenAI falla, no hay reintento: el agente responde un mensaje de espera segura, marca que hace falta un humano y deja el error registrado en la tabla `errores_agente`. Nunca deja al cliente sin respuesta.

# PARTE 3 — Los 14 encargos

## 11. Cómo se construye, encargo por encargo

### Cómo hablarle a Claude

Cinco reglas de trabajo. Si las sigues, el proyecto avanza solo:

1. **Un encargo por conversación.** Le pegas el texto del encargo, él construye, corre los chequeos y te muestra el resultado. No le pidas dos encargos juntos.
2. **El chequeo manda.** Si `pnpm typecheck`, `pnpm lint` o las pruebas salen en rojo, el encargo no está hecho. No se avanza "y después lo arreglamos".
3. **Ninguna advertencia se ignora.** Una advertencia tolerada se vuelve permanente, y la siguiente advertencia de verdad se esconde adentro.
4. **Si algo parece necesitar un no-objetivo de la sección 2, es un error del plan.** Que se detenga y te avise, en vez de construirlo.
5. **Al terminar cada encargo, un commit.** `git add -A` y un commit con el nombre del encargo. Es tu botón de deshacer.

Antes de cada encargo conviene darle el contexto de una línea: "estamos construyendo el proyecto de Lavandería VIP según la guía; el catálogo tiene 54 filas y el esquema 14 tablas; las pruebas corren contra el único proyecto de Supabase, y está bien que escriban y borren datos".

### Mapa de dependencias

| Encargo | Necesita antes |
|---|---|
| 1 Base y salud | — |
| 2 Esquema y catálogo | 1 |
| 3 Login y protección | 2 |
| 4 Servicios y Clientes | 3 |
| 5 Configuración y ventana horaria | 3 |
| 6 Cola de hoy y lista de Pedidos | 3 |
| 7 Detalle, verificación, pago y corrección | 6 |
| 8 Webhook y motor de precios | 2 |
| 9 Crear y consultar pedidos | 8 |
| 10 Acciones del operador | 9 |
| 11 Reportes, límites y costo | 10 |
| 12 n8n y su validación | 1 |
| 13 Chatwoot y WhatsApp | 11 y 12 |
| 14 Despliegue y humo | 7 y 13 |

Los encargos 8 a 11 solo necesitan el encargo 2, así que si quieres el agente antes que el panel, puedes saltar del 3 al 8 y volver después. El orden de arriba es el recomendado.

---

### Encargo 1 — La base y el chequeo de salud

**Construye:** `src/lib/env.ts`, `src/lib/supabase/admin.ts`, `src/lib/supabase/anon-server.ts`, `src/app/api/health/route.ts` y su prueba.

> Construye la base del proyecto. Primero `src/lib/env.ts`: un esquema de zod que valide las variables de entorno y falle al arrancar nombrando la que falta. En este encargo son obligatorias SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. N8N_WEBHOOK_SECRET todavía no, esa entra en el encargo 8. Después dos clientes de Supabase: `admin.ts` con la clave de service role, sin persistir sesión, solo servidor; y `anon-server.ts` con la clave anon, que solo se usa para verificar tokens. Por último `GET /api/health`, que consulta una fila de `configuracion` y responde 200 con `{"ok":true}` o 503 si no hay conexión. Escribe también `tests/unit/lib/env.test.ts`, que pruebe el arranque con variables faltantes y con todas presentes.

**Quedó bien cuando:** sin `SUPABASE_URL` el proceso falla nombrando esa variable; con todas presentes el objeto de entorno queda tipado, sin ningún `any`; `/api/health` responde 200 contra el Supabase real.

```
pnpm typecheck
pnpm test tests/unit/lib/env.test.ts
pnpm build
pnpm smoke:health
```

---

### Encargo 2 — El esquema y el catálogo

**Construye:** `src/types/database.ts` y `tests/integration/db/schema.test.ts`.

> Aplica y verifica el esquema. Las migraciones y los scripts ya están en el repo, no los reescribas: corre `pnpm db:test:migrate` y `pnpm db:test:seed` contra el proyecto de Supabase. Después escribe a mano `src/types/database.ts` con los tipos de las 14 tablas, sin generador. Y escribe `tests/integration/db/schema.test.ts`, que consulte las 14 tablas, cuente exactamente 54 filas en `servicios`, compruebe que no se puede insertar dos veces el mismo par nombre y método, y que al borrar un pedido se borran en cascada sus ítems y sus eventos.

**Quedó bien cuando:** la migración corrida dos veces aplica 2 la primera vez y 0 la segunda; la siembra deja 54 filas exactas; las 14 tablas responden; la restricción única rechaza el duplicado; el borrado en cascada funciona.

```
pnpm db:test:migrate
pnpm db:test:migrate
pnpm db:test:seed
pnpm test tests/integration/db/schema.test.ts
pnpm typecheck
```

---

### Encargo 3 — Entrar al sistema

**Construye:** `src/lib/auth.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/callback/route.ts`, `src/proxy.ts` y su prueba.

> Construye la autenticación con enlace mágico. `verifyAuth(token)` verifica el token contra Supabase, busca la fila de `staff` por `auth_user_id` y devuelve null si el token es inválido, si no hay fila de staff o si el staff está inactivo. Nunca lanza una excepción. La pantalla de login es un formulario de correo con una acción de servidor que manda el enlace mágico. El callback intercambia el código por sesión y guarda los tokens en cookies httpOnly, seguras. `src/proxy.ts` — que en Next 16 reemplaza a middleware.ts — protege todo el panel y manda a `/login` a quien no tenga sesión válida. Escribe `tests/unit/lib/auth.test.ts`.

**Quedó bien cuando:** una visita anónima a cualquier pantalla del panel termina en `/login`; un token válido devuelve la fila de staff; un token inválido devuelve null sin reventar; un staff inactivo se trata como no autenticado aunque su token siga vivo.

```
pnpm typecheck
pnpm test tests/unit/lib/auth.test.ts
pnpm build
```

---

### Encargo 4 — Servicios y Clientes

**Construye:** las pantallas y acciones de `/servicios` y `/clientes`, sus repositorios, `src/lib/format.ts` y dos pruebas de integración.

> Construye dos secciones del CRM. La de Servicios lista las 54 filas agrupadas por categoría y permite editar precio, crear un servicio nuevo rechazando duplicados de nombre y método, y desactivar uno. Editar y crear solo los puede hacer el dueño: si el rol es operador, la acción se rechaza con un error de autorización. La de Clientes es una lista paginada en el servidor de 50 por página con filtro por tipo de negocio, más una pantalla de detalle con el historial de pedidos ordenado del más nuevo al más viejo, y las acciones de crear y editar. Un cliente creado con facturación mensual consolidada arranca con saldo en cero. Todo el acceso a datos pasa por `src/server/servicios/repo.ts` y `src/server/clientes/repo.ts`. Agrega `src/lib/format.ts` con el formateo de moneda en dólares para Ecuador. Escribe las dos pruebas de integración.

**Quedó bien cuando:** `/servicios` muestra las 54 filas por categoría; un precio editado persiste; un duplicado se rechaza; un operador no puede editar precios; `/clientes` pagina de a 50 y filtra por tipo.

```
pnpm typecheck
pnpm lint
pnpm test tests/integration/servicios/crud.test.ts
pnpm test tests/integration/clientes/crud.test.ts
```

---

### Encargo 5 — Configuración y ventana horaria

**Construye:** `/configuracion` con su acción, `src/server/scheduling/ventana.ts` y su prueba.

> Construye la pantalla de Configuración: horarios de recolección, días de operación, lista blanca de operadores y tarifa del combo. Solo el dueño puede guardar. Al agregar un número a la lista blanca, normalízalo a formato internacional E.164 antes de guardarlo. Aparte, escribe `obtenerProximaVentana(ahora, config)` en `src/server/scheduling/ventana.ts`, usando solo `Intl` con la zona America/Guayaquil, sin ninguna librería de fechas. Tiene que devolver siempre una ventana futura real: si hoy no es día de operación, la del siguiente día configurado; si son las 2 de la mañana, nunca una ventana que ya pasó. Escribe `tests/unit/scheduling/ventana.test.ts` cubriendo esos dos casos.

**Quedó bien cuando:** el horario guardado persiste en la fila única de configuración; la ventana siempre cae en el futuro; los números quedan normalizados.

```
pnpm typecheck
pnpm lint
pnpm test tests/unit/scheduling/ventana.test.ts
```

---

### Encargo 6 — Cola de hoy y lista de Pedidos

**Construye:** `src/app/(dashboard)/page.tsx`, `src/server/pedidos/repo.ts`, la barra lateral, `/pedidos` y su tabla.

> Construye la pantalla de inicio y la lista de pedidos. La Cola de hoy muestra los pedidos cuya ventana de recolección empieza hoy, ordenados por hora ascendente, con los que están en estado nuevo resaltados arriba; si no hay nada, un estado vacío con el mensaje "Sin pedidos programados para hoy", nunca una tabla en blanco. Crea `src/server/pedidos/repo.ts` como la única puerta de acceso a la tabla de pedidos. Agrega la barra lateral con la navegación filtrada por rol. Después la pantalla `/pedidos`: lista paginada en el servidor de 50 por página, con filtros por estado y por canal; cuando se filtra por canal presencial, las columnas de dirección y vehículo no se muestran porque no aplican. Escribe `tests/integration/pedidos/cola-de-hoy.test.ts`.

**Quedó bien cuando:** la cola ordena por hora y resalta los nuevos; el estado vacío aparece con su mensaje; la lista pagina y los dos filtros funcionan.

```
pnpm typecheck
pnpm lint
pnpm test tests/integration/pedidos/cola-de-hoy.test.ts
```

---

### Encargo 7 — Detalle del pedido: conteo, pago y corrección

**Construye:** `/pedidos/[id]` con su página, sus acciones, el checklist, `src/server/pedidos/estado.ts` y dos pruebas.

> Construye la pantalla más importante del operador: el detalle del pedido. Muestra el resumen, la foto previa a la recolección o un aviso claro si no llegó ninguna, la línea de tiempo y el checklist de verificación de conteo. Cuando el operador confirma el conteo, se crean las filas de ítems verificados enlazadas a cada ítem declarado. Si alguna cantidad no coincide, el pedido se marca con discrepancia y NO avanza a en proceso; si todas coinciden, avanza automáticamente. Agrega las acciones de confirmar pago y corregir cotización, y escribe `src/server/pedidos/estado.ts` con la máquina de transiciones de estado, que también usarán los encargos 9 y 10. Confirmar el pago de un tramo lo marca pagado y libera el pedido para despacho. Corregir una cotización escribe la fila de auditoría, actualiza el monto confirmado y marca la discrepancia. Mientras haya discrepancia, el botón de avanzar de estado queda bloqueado en la interfaz. Escribe `tests/integration/pedidos/verificacion.test.ts` y `tests/integration/pedidos/pago-y-correccion.test.ts`.

**Quedó bien cuando:** el conteo distinto congela el pedido; el conteo igual lo avanza solo; el pago confirmado libera el despacho; la corrección deja rastro en la auditoría y bloquea el avance.

```
pnpm typecheck
pnpm lint
pnpm test tests/integration/pedidos/verificacion.test.ts
pnpm test tests/integration/pedidos/pago-y-correccion.test.ts
```

---

### Encargo 8 — El webhook y el motor de precios

**Construye:** `src/server/pricing/cotizar.ts`, `src/server/webhook/schemas.ts`, `src/app/api/webhook/route.ts`, `src/server/webhook/handlers/cliente.ts` y la prueba del motor.

> Construye el corazón del agente. Primero `src/server/pricing/cotizar.ts` con `cotizarPrendas(items, catalogo)` y `calcularVehiculo(numeroFundas)`, que es la única fuente de verdad de precios de todo el sistema: busca por nombre normalizado en minúsculas y sin tildes; si la fila exige método y no viene, responde que requiere método sin precio; si no encuentra el ítem, responde no encontrado con la nota "a confirmar por el operador" y sin precio; si el precio es un rango devuelve ambos límites sin subtotal; y el total siempre viaja marcado como estimado pendiente de verificación. Una funda es moto, más de una es auto. Después `src/app/api/webhook/route.ts`: valida la cabecera `x-webhook-secret` con comparación de tiempo constante y responde 401 sin leer la acción si no coincide; despacha por nombre de acción; y a partir de aquí `N8N_WEBHOOK_SECRET` pasa a ser una variable obligatoria en `env.ts`. Agrega los esquemas de zod por acción y el manejador `handlers/cliente.ts` con las siete acciones de cliente. Escribe `tests/unit/pricing/cotizar.test.ts` cubriendo los seis casos del catálogo: método único, doble método, rango, por libra, por paquete y no reconocido.

**Quedó bien cuando:** "3 camisetas" sin método responde que requiere método, sin precio; "3 camisetas" con método agua da 6.75; un ítem inexistente responde sin precio y con la nota; `calcularVehiculo(1)` da moto y cualquier número mayor da auto; una petición sin el secreto correcto responde 401 sin ejecutar nada.

```
pnpm typecheck
pnpm lint
pnpm test tests/unit/pricing/cotizar.test.ts
```

---

### Encargo 9 — Crear y consultar pedidos desde el agente

**Construye:** `src/server/webhook/handlers/pedidos.ts`, la creación en el repositorio de pedidos y su prueba.

> Agrega al webhook las acciones `crear_pedido` y `consultar_estado_pedido`. Las reglas de estado inicial: si es a la carta y los dos tramos los mueve la lavandería, el pedido nace esperando el pago de la recolección; si es combo, el monto del combo sale de la tarifa vigente de configuración; y por encima de todo lo anterior, si el cliente es de facturación mensual consolidada, el pedido siempre nace en estado nuevo. `consultar_estado_pedido` devuelve el pedido más reciente de ese teléfono. Crear un pedido debe generar también sus ítems declarados y el primer evento de la línea de tiempo. Escribe `tests/integration/webhook/crear-pedido.test.ts`.

**Quedó bien cuando:** la matriz de pagos se cumple en los tres casos; el cliente mensual nunca cae en un estado de espera de pago; el combo toma la tarifa vigente; la consulta devuelve el más reciente.

```
pnpm typecheck
pnpm lint
pnpm test tests/integration/webhook/crear-pedido.test.ts
```

---

### Encargo 10 — Las acciones del operador

**Construye:** `src/server/webhook/handlers/operador.ts` y su prueba.

> Agrega al webhook las cuatro acciones del operador. `registrar_cliente_presencial` crea un pedido de canal presencial, sin dirección ni datos de vehículo. `actualizar_registro` corrige un pedido creado hace menos de una hora por el mismo canal de operador, actualizando sus ítems declarados sin crear un pedido duplicado — esto existe porque una nota de voz se puede transcribir mal. `confirmar_pago` marca pagado el tramo indicado y saca al pedido del estado de espera. `corregir_cotizacion` escribe en la tabla de auditoría, actualiza el monto confirmado, marca la discrepancia y nunca permite que el monto original se vuelva a cobrar. Escribe `tests/integration/webhook/operador.test.ts`.

**Quedó bien cuando:** el pedido presencial nace sin logística; la corrección por voz no duplica pedidos; el pago saca al pedido de la espera; el monto viejo queda sepultado.

```
pnpm typecheck
pnpm lint
pnpm test tests/integration/webhook/operador.test.ts
```

---

### Encargo 11 — Reportes, límite de mensajes y alerta de costo

**Construye:** `handlers/reportes.ts`, `rate-limit.ts`, `cost-tracking.ts` y su prueba.

> Cierra el webhook con tres piezas. `generar_reporte` devuelve ingresos por rango de fechas agrupados por tipo de negocio del cliente, y `consultar_pedido` busca por nombre parcial sin distinguir mayúsculas, para que un error de tipeo no esconda el pedido. `rate-limit.ts` cuenta los mensajes por teléfono y por día contra el tope de configuración, y se invoca antes de despachar cualquier acción que venga del agente; al pasarse, rechaza el mensaje con un código de error identificable sin ejecutar la acción. `cost-tracking.ts` acumula el uso diario de OpenAI y marca la alerta como enviada exactamente una vez por día cuando se supera el techo configurado, aunque el día siga sumando llamadas. Escribe `tests/integration/webhook/reportes-y-limites.test.ts`.

**Quedó bien cuando:** el reporte agrupa por tipo de negocio; el mensaje 41 del día se rechaza; la alerta se marca una sola vez por día; la búsqueda parcial encuentra.

```
pnpm typecheck
pnpm lint
pnpm test tests/integration/webhook/reportes-y-limites.test.ts
```

---

### Encargo 12 — n8n: validar el agente y documentar Railway

**Construye:** dos pruebas sobre el archivo del workflow y `n8n/README.md`.

> El archivo del workflow de n8n ya está escrito y versionado, con sus 22 nodos y sus dos ramas: no lo crees de nuevo, verifícalo. Escribe `tests/unit/n8n/constitucion-cliente.test.ts` y `tests/unit/n8n/constitucion-operador.test.ts`, que lean el JSON y comprueben lo siguiente: que el nodo de constitución del cliente contiene las cadenas "Tool First" y "usted" y la lista cerrada de frases de escalación a un humano; que los dos nodos de OpenAI de la rama cliente declaran temperature 0, top_p 0.1 y respuesta en formato JSON; que el nodo de transcripción referencia gpt-transcribe y nunca whisper-1; y que la constitución del operador dice explícitamente que ese canal solo lee y crea, jamás borra. Corre también el validador estructural para las dos ramas. Después escribe `n8n/README.md` con los pasos para importar el workflow a la instancia de Railway, configurar sus variables de entorno — CRM_BASE_URL, N8N_WEBHOOK_SECRET, OPENAI_API_KEY, CHATWOOT_BASE_URL, CHATWOOT_API_TOKEN, CHATWOOT_ACCOUNT_ID — y activarlo.

**Quedó bien cuando:** el validador sale en verde para las dos ramas y las dos pruebas pasan.

```
pnpm exec tsx scripts/validate-n8n-workflow.ts --rama=cliente n8n/workflows/agente-lavanderia-vip.json
pnpm exec tsx scripts/validate-n8n-workflow.ts --rama=operador n8n/workflows/agente-lavanderia-vip.json
pnpm test tests/unit/n8n
```

---

### Encargo 13 — Chatwoot y WhatsApp

**Construye:** `scripts/check-integraciones-env.ts`, `docs/integraciones-chatwoot-whatsapp.md` y su prueba.

> Escribe `scripts/check-integraciones-env.ts`, que valide el formato de las nueve variables de Chatwoot, WhatsApp y n8n: que ninguna esté vacía, que CHATWOOT_BASE_URL sea una URL válida y que WHATSAPP_PHONE_NUMBER_ID y CHATWOOT_ACCOUNT_ID sean numéricos. Si algo falla, sale con código 1 nombrando la variable culpable. No prueba conectividad real, solo formato. Escribe también `docs/integraciones-chatwoot-whatsapp.md` documentando los pasos que se hacen a mano y que no son automatizables: crear el inbox de WhatsApp en Chatwoot, registrar la URL del webhook de n8n en ese inbox, suscribir el número de WhatsApp Cloud API al mismo webhook y verificar el negocio en Meta Business Manager. Déjalos marcados explícitamente como checklist de lanzamiento, no como parte del build. Y su prueba unitaria.

**Quedó bien cuando:** con las nueve variables correctas el script sale en 0; si falta una, sale en 1 y la nombra.

```
pnpm typecheck
pnpm test tests/unit/scripts/check-integraciones-env.test.ts
```

---

### Encargo 14 — Despliegue y prueba de humo

**Construye:** `next.config.ts` con las cabeceras de seguridad, `.github/workflows/ci.yml`, `docs/despliegue.md` y las pruebas de navegador.

> Cierra el proyecto. Edita `next.config.ts` para que todas las rutas respondan con las cabeceras `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin`. Escribe `.github/workflows/ci.yml` con el pipeline instalar, typecheck, lint, test y build, cada paso condicionado al éxito del anterior. Escribe `docs/despliegue.md` con los pasos de Vercel — proyecto nuevo, variables de entorno, dominio — y de Railway — dos servicios, n8n y Chatwoot, cada uno con su volumen y sus variables. Instala los navegadores de Playwright y escribe las pruebas de extremo a extremo: la lista de pedidos se dibuja sin errores de consola; confirmar un pago desde el detalle cambia el estado en pantalla sin recargar; y la de humo completo, que recorre login, Cola de hoy, crear un pedido presencial de prueba, verlo en Pedidos y confirmar su pago, y que además pide `/api/health` por HTTP para comprobar las dos cabeceras de seguridad.

**Quedó bien cuando:** compila; el servidor construido responde 200 en salud con las dos cabeceras; toda la suite de pruebas y la de navegador pasan en verde.

```
pnpm exec playwright install
pnpm build
pnpm smoke:health
pnpm test
pnpm test:e2e
```

# PARTE 4 — Cierre

## 12. Despliegue

| Pieza | Dónde vive | Cómo se despliega |
|---|---|---|
| El CRM | Vercel, proyecto propio | Se conecta el repositorio; el comando de build es `pnpm build` y lo detecta solo. Runtime Node 24. Región sugerida `gru1` |
| n8n | Railway, servicio propio | Imagen `n8nio/n8n:2.38.7`, con su volumen y sus variables |
| Chatwoot | Railway, servicio propio | Imagen `chatwoot/chatwoot:v4.17.1-ce`, con su volumen y sus variables |
| La base de datos | Supabase, el proyecto `lavanderia-vip` | Las migraciones se corren a mano antes de desplegar el código |

### Los entornos

| Entorno | Rama | Base de datos |
|---|---|---|
| Local | — | El proyecto `lavanderia-vip` |
| Vista previa | cualquier PR | El mismo proyecto |
| Producción | `main` | El mismo proyecto, mientras siga siendo fase de pruebas |

**Cuándo separar.** El día que entre el primer pedido de un cliente real, se crea un segundo proyecto de Supabase, se corren las migraciones y la siembra ahí, y se deja el proyecto original solo para desarrollo y pruebas. Es media hora de trabajo y evita que una corrida de pruebas borre pedidos que ya facturaste. Antes de ese día, no aporta nada.

### Regla de migraciones en producción

Las migraciones se corren **a mano y antes** de desplegar el código que las necesita, con `pnpm db:migrate` apuntando a la base de producción. Y siempre expandir antes de contraer: nunca se elimina una columna en el mismo despliegue en que se retira su último uso. Primero se deja de usar, se despliega, y en un despliegue posterior se elimina.

### Volver atrás

En Vercel cada despliegue queda guardado: volver atrás es promover uno anterior, es instantáneo y no reconstruye nada. En Railway, cada servicio se vuelve a desplegar desde su imagen fija, y revertir configuración es revertir sus variables.

---

## 13. Seguridad

| Preocupación | Control |
|---|---|
| Secretos | Solo en las variables de entorno de Vercel y Railway. Nunca en el repositorio, nunca en un log, nunca en el navegador |
| Entrada de datos | Validación con zod en cada acción del webhook y cada acción de servidor del CRM |
| Inyección SQL | El cliente de Supabase parametriza siempre; los scripts usan plantillas parametrizadas, nunca concatenación de texto |
| Permisos | Se revisan en el servidor, en cada petición, antes de hacer el trabajo |
| El webhook | Secreto compartido comparado en tiempo constante, más el libro de mensajes ya procesados |
| Abuso | Tope diario de mensajes configurable por teléfono |
| Cabeceras | `nosniff` y `strict-origin-when-cross-origin` en todas las rutas |
| Datos personales | Se guardan teléfono, nombre, dirección y tipo de negocio, nada más. Nunca se registra en un log el contenido completo de un mensaje |

La única llave que llega al navegador es la clave anon de Supabase, que está diseñada para ser pública. La clave de service role jamás sale del servidor.

**LOPDP (Ecuador):** cumplimiento mínimo en esta versión: un aviso de privacidad una sola vez por cliente nuevo, y solo se recolecta lo necesario para operar. No hay portal de derechos ARCO ni proceso formal de borrado a solicitud. Es un riesgo aceptado y anotado; se revisita si el negocio crece.

---

## 14. Qué va a costar

| Servicio | Al lanzar | A diez veces el volumen |
|---|---|---|
| Supabase | 0 | unos 25 al mes |
| Vercel | 0 | unos 20 al mes |
| Railway, n8n más Chatwoot | 10 a 15 al mes | 40 a 60 al mes |
| OpenAI | Según volumen, con techo configurable | El mismo techo lo acota |

**Estimado al lanzamiento: entre 15 y 25 dólares al mes.** El renglón más grande es Railway, por los dos servicios siempre encendidos. Apagar n8n de noche bajaría el costo, pero el agente está diseñado para responder 24/7, así que esa palanca tiene un costo de producto y no se activa por defecto.

Lo que hay que vigilar: el gasto de OpenAI. El control no lo pone la plataforma, lo pone tu configuración. Si pones el techo demasiado alto, el techo no sirve.

---

## 15. Antes de lanzar

Cuando los 14 encargos estén en verde, todo esto tiene que salir en 0 en una copia limpia del proyecto:

```
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm db:test:migrate && pnpm db:test:seed
pnpm test
pnpm test:e2e
pnpm build
pnpm smoke:health
pnpm validate:n8n
```

Y estas revisiones se hacen una vez, a mano:

- Todas las variables de entorno están puestas en Vercel y Railway, y ninguna está en el repositorio.
- Los cuatro flujos críticos pasan contra la URL de producción real, ya desplegada.
- Un recorrido usando solo el teclado, y una pasada con lector de pantalla sobre Cola de hoy y Detalle de pedido.
- Los tres pasos manuales de Chatwoot y WhatsApp están hechos: inbox creado, webhook de n8n registrado en ese inbox, número suscrito.
- **La verificación de negocio en Meta está completa y hay al menos una plantilla de mensaje aprobada, ANTES de gastar en pauta.** Una cuenta nueva empieza con un límite bajo de conversaciones por día.
- Una pasada manual de evaluación: una decena de mensajes representativos contra el agente real, leyendo las respuestas una por una.
- Un rollback ejecutado a propósito una vez, en una vista previa de Vercel, para saber que funciona antes de necesitarlo.
- Ningún no-objetivo de la sección 2 terminó construido.

---

## 16. Riesgos conocidos

| Riesgo | Qué tan probable | Qué hacer |
|---|---|---|
| No existe API de despacho de courier en Ecuador | Ya confirmado, no es una posibilidad | El despacho lo confirma una persona. Es la decisión de esta versión, no un pendiente |
| Cuenta nueva de WhatsApp con límite bajo de mensajes | Alta | Verificar el negocio en Meta y aprobar una plantilla antes de escalar la pauta |
| El modelo de negocio: el costo del courier se come el margen | Media, y hundió empresas parecidas | Ya mitigado por diseño: el cliente siempre paga el transporte, en los dos tipos de entrega. El negocio nunca subsidia el flete |
| Alguien satura el número y dispara el costo de OpenAI | Media | Tope de mensajes por teléfono más techo diario de gasto con alerta |
| El motor de precios se equivoca en un caso raro: rango, paquete, doble método | Media | Los seis casos están cubiertos por pruebas, y toda cotización es estimada hasta la verificación en planta |
| Una prueba borra datos reales | Nula hoy, alta el día del primer cliente | Hoy no hay datos reales que perder. Separar en dos proyectos de Supabase el día que entre el primer pedido de verdad |
| Una solicitud formal de borrado de datos bajo LOPDP | Baja | Fuera de alcance en esta versión, anotado como riesgo aceptado |

---

## Las siete decisiones que ya están tomadas

Para que no se vuelvan a discutir a mitad del camino:

1. **Sin ORM.** Se usa el cliente de Supabase crudo y migraciones SQL propias. Es la convención que ya funciona en tu otro sistema.
2. **Sin Supabase CLI.** El script propio de migración hace el trabajo para dos archivos de migración.
3. **Sin librería de fechas.** Ecuador es UTC-5 fijo, sin horario de verano: `Intl` alcanza.
4. **Un solo archivo de workflow de n8n** con las dos ramas, cliente y operador. Así es como funciona el negocio: un solo número, una sola decisión al entrar.
5. **OpenAI se llama por HTTP desde n8n**, sin instalar su SDK en el CRM. El CRM nunca hablaría con OpenAI: instalarlo sería una dependencia sin uso.
6. **Enlace mágico en vez de contraseña.** Dos o tres cuentas conocidas no justifican gestionar reseteos.
7. **Las pruebas corren contra el único proyecto de Supabase**, no contra una base local. Esta es la decisión que reemplazó a Docker. Mientras no haya clientes reales, que las pruebas escriban y borren ahí no cuesta nada; el día que los haya, se separa en dos proyectos.

---

*Fin de la guía. El orden de construcción es la sección 11. Se termina cuando la sección 15 esté toda en verde.*
