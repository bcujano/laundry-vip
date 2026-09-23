# Estado y continuidad

Última actualización: **2026-09-23**. Traspaso entre sesiones: léelo entero
antes de tocar nada. La historia del plan original del agente está en
[`historia-agente.md`](historia-agente.md).

---

## 0. Arranque rápido

**Prompt para abrir la siguiente sesión** (el dueño lo pega tal cual):

> Continúo Lavandería VIP en `C:\dev\laundry-vip`. Lee `CLAUDE.md` y
> `docs/CONTINUIDAD.md` completos antes de nada. Estamos en producción: CRM en
> https://laundry-vip.vercel.app y agente de WhatsApp en n8n (workflow
> `Bleb55WBKPfBdxVg`) con el número definitivo +593 98 566 2822. Revisa la
> sección «Lo pendiente» y dime en 5 líneas qué recomiendas hacer primero.
> No toques nada de 321.

**Verificación en 1 minuto** de que todo sigue vivo:

```bash
curl -s https://laundry-vip.vercel.app/api/health
```
```bash
pnpm typecheck && pnpm lint && pnpm test
```

Y en n8n (MCP): `search_workflow_executions` sobre `Bleb55WBKPfBdxVg`. Si el MCP
dice «Workflow is not available in MCP», el dueño tiene que activarlo en la
tarjeta del workflow (se apaga cada vez que se reimporta).

---

## 1. Dónde estamos

Todo en producción y usado a diario en pruebas reales.

| | |
|---|---|
| CRM | **https://laundry-vip.vercel.app** · Vercel `bcujanos-projects/laundry-vip` · deploy con `npx vercel --prod --yes` desde `C:\dev\laundry-vip` (el CLI ya tiene sesión) |
| Base | Supabase `cvdlslltevwxprdktmfu` (São Paulo). **Es la única base: pruebas y producción comparten** |
| Agente | n8n `https://primary-production-ed243.up.railway.app` · workflow **`Bleb55WBKPfBdxVg`** «iAgente Laundry VIP» (59 nodos, activo) |
| Chatwoot | `https://chatwoot-production-8564.up.railway.app` · **cuenta 3** · entrada nueva del número definitivo |
| WhatsApp | **+593 98 566 2822** · phone ID `1220603671147410` · WABA `1755486442349144` · app Meta «Laundry VIP» |
| Repo | local, **sin remoto** · 39 commits · etiqueta **`v1.0`** = estado con el número de prueba |
| Gate | **223 pruebas en verde** · typecheck, lint y build limpios (se retiraron 30 del workflow obsoleto de la fase 12) |
| Catálogo | **Manda el CRM.** Nació de [`catalogo-lavanderia.xlsx`](catalogo-lavanderia.xlsx) (54 filas) pero lo que vale es lo que está en la tabla `servicios`. `pnpm db:seed` ya no lo pisa; la lista de precios de hoy se baja en Servicios → «Descargar lista de precios» |

**Entrar al CRM:** `brncjn@gmail.com` (superadmin). La contraseña provisional
la puso una sesión anterior; el dueño debe cambiarla.

**Respaldo v1.0:** `git checkout v1.0` · copia del workflow y prompts en
`n8n/versiones/v1.0/` · zip en `Downloads\laundry-vip-v1.0.zip` · y el historial
de versiones de n8n.

---

## 2. Cómo funciona el agente

```
WhatsApp → Meta (app Laundry VIP) → Chatwoot cuenta 3 → webhook → n8n
  Filtro Chatwoot → Filtro Humano (etiqueta «humano» apaga el bot)
  → WhatsApp Inicio → Debounce 30 s → ¿es el último mensaje? → combina textos
  → texto | audio (gpt-transcribe) | imagen (visión → hechos estructurados)
  → Verificar Operador (CRM) → ¿Es Operador?
       sí → Agente Operador (prompt de planta + nivel)
       no → Agente Laundry VIP (clientes)
  → Extraer JSON (parser + GUARDIA) → respuesta por Chatwoot
                                   → ¿escalar? → etiqueta humano + nota
                                   → Registrar cliente y conversación en el CRM
Resumen 8:00 (L-S) → datos del CRM → un mensaje por admin → ¿escribió en < 23 h?
       sí → texto libre · no → plantilla resumen_diario_admin (si Meta la aprobó)
```

- **Clientes:** 6 tools HTTP contra `POST /api/webhook` (`cotizar_prendas`,
  `obtener_proxima_ventana`, `calcular_vehiculo`, `find_or_create_client`,
  `crear_pedido`, `consultar_estado_pedido`). Precios, tarifa de recogida y
  entrega, horario y lapso de entrega **se leen del CRM en cada consulta**:
  nada de eso está en el prompt.
- **Cada turno registra en el CRM** (patrón del CRM WEB de 321): cliente y
  conversación, aunque no compre. El nombre del perfil de WhatsApp entra como
  nombre **provisional**; el que diga el cliente lo reemplaza y lo editado en
  el CRM nunca se pisa. Los operadores no cuentan como leads.
- **Números autorizados, dos niveles** (tabla `operador_whitelist.nivel`):
  - `operador`: registrar y corregir órdenes presenciales (texto, voz o foto),
    buscar pedidos, registrar el conteo en planta y avanzar estados.
  - `admin`: además `generar_reporte` y `consulta_admin` (resumen, atención,
    cola de mañana, leads calientes, clientes top) y el resumen de las 8:00.
  - Los permisos los decide el servidor (`src/server/webhook/handlers/permisos.ts`).
- **Nada de dinero por WhatsApp** (decisión del dueño): confirmar pagos,
  corregir montos, cerrar discrepancias, cancelar y borrar se hacen **solo en
  el CRM**. Esas acciones ya no existen en el webhook.
- **El catálogo no se toca en n8n.** Precios, categorías y promociones viven en
  la tabla `servicios`; el agente los lee en cada consulta. Lo que el dueño
  cambia en el CRM rige en el siguiente mensaje: no hay nada que republicar.
- **Nada revierte al CRM.** `pnpm db:seed` solo carga el catálogo si la tabla
  está vacía; si ya hay datos no escribe nada y reporta en qué se diferencia de
  la lista del archivo. Para reimponer el archivo hace falta `--forzar`.
  Las pruebas leen los precios de la base (`tests/util/catalogo.ts`) y no
  exigen un número fijo de ítems: el dueño agrega y quita desde el CRM.
- **Lo que el agente promete** (todo sale del CRM, nada del prompt): entrega de
  48 a 72 horas (`horas_entrega_min/max`, la fecha exacta la acuerda el operador
  en planta), tarifa única de recogida y entrega (`tarifa_recoleccion_entrega`,
  aparte del lavado) y recolección de lunes a sábado. En el primer mensaje
  saluda, pregunta el nombre y da el aviso de uso de datos (LOPDP).
- **El nombre del negocio sale del CRM.** `verificar_whitelist_operador` —que
  n8n llama en cada mensaje, antes de los dos agentes— devuelve
  `negocio.nombre`, y los dos prompts lo leen con
  `{{ $('Verificar Operador').first().json?.data?.negocio?.nombre }}`. Hoy
  Configuración dice **VIP Laundry** y así se presenta; si el dueño lo cambia,
  el agente cambia en el siguiente mensaje. La dirección y el fijo siguen
  escritos en el prompt.
- **El nombre del cliente se corrige solo.** El del perfil de WhatsApp es
  provisional; el que diga el cliente lo reemplaza, incluso si él mismo se
  corrige después. Lo que el equipo escribe en el CRM no se pisa nunca
  (`clientes.nombre_contacto_origen`, migración 0010).
- **El método de lavado lo manda el catálogo** (migración 0010): cada prenda
  declara si va en agua o en seco. Si el cliente pide lavar un terno en agua,
  `cotizar_prendas` lo cotiza en seco y devuelve `advertencia`. `metodo_unico`
  le dice al agente que no hay alternativas que ofrecer.
- **Ni «combo» ni «a la carta».** Es una lavandería: o se recoge y entrega con
  la tarifa única, o el cliente trae y retira. Los valores `combo` y
  `a_la_carta` siguen en la base porque hay pedidos viejos con ellos; lo que se
  lee en pantalla sale de `entregaLegible` en `src/lib/format.ts`.
- **Promociones por cantidad** (`cantidad_por_paquete` + `precio_paquete`,
  migración 0009): las cobijas pequeñas son $5,00 sueltas y 3 por $12,00. El
  sobrante se cobra suelto, nunca se redondea a otro paquete.
- **Guardia anti-alucinación** en `Extraer JSON`: si el agente confirma una
  escritura sin que la tool haya respondido ok, o escribe un UUID que no salió
  de una tool, el mensaje se reemplaza. Nació de una orden inventada con ID falso.

Prompts: `n8n/prompt-agente-laundry.md` y `n8n/prompt-operador-laundry.md`
(una prueba exige que sean idénticos a los del JSON).

---

## 3. Cómo cambiar el agente

1. **Edita el prompt `.md` o el generador** en `n8n/generador/` y regenera:
   ```bash
   node n8n/generador/generar.cjs
   ```
   Necesita `iAgente 321 INMO V2.json` en Descargas (o su ruta como argumento).
   **Ese archivo no se versiona:** trae un secreto literal de 321.
2. `pnpm biome check --write n8n` y el gate completo.
3. **Aplica en n8n por MCP** (`update_workflow` sobre `Bleb55WBKPfBdxVg`,
   operaciones puntuales) y `publish_workflow`. El dueño autorizó el MCP para
   **este** workflow. Nunca reimportes el JSON entero: cambia el id, apaga el
   MCP y choca la ruta del webhook con el activo.
4. Verifica con una ejecución real (`get_workflow_execution` con `includeData`).

El JSON del repo (`n8n/workflows/laundry-vip-agente.json`) es el espejo del
workflow vivo; si editas en n8n a mano, regenera para que no se desalineen.

---

## 4. Decisiones del dueño (no revertir sin preguntarle)

| Decisión | Por qué |
|---|---|
| El agente es el workflow de 321 **clonado y recortado**, no uno nuevo | Instrucción textual del dueño; ver `historia-agente.md` |
| Tres roles en el CRM (`superadmin`/`admin`/`operador`) | Lo pidió; la spec decía dos |
| Contraseña en vez de enlace mágico | El enlace entraba en bucle |
| AI Agent de LangChain, no «Tool First» | Es lo que el dueño ya opera |
| Registro en el CRM en cada turno | Como el CRM de 321: todo lead queda, compre o no |
| Dos niveles de WhatsApp autorizado y **nada de dinero por WhatsApp** | Decisión explícita del 2026-09-17 |
| Resumen diario automático para admins, **texto libre** dentro de las 24 h de Meta | El CRM anota la hora del último mensaje de cada autorizado (migración 0008); la plantilla es solo respaldo. Meta acepta el texto fuera de ventana y falla después, por eso se decide antes |
| Nombre de WhatsApp como nombre provisional del lead | El dueño no quiere leads «Sin nombre» |
| Descargas de clientes/pedidos solo para superadmin y admin | Datos personales (LOPDP) |
| Las categorías del catálogo son las de la lista física del dueño (13, por prenda) | Entregó `catalogo_lavanderia.xlsx` el 2026-09-21. Los `nombre_item` no se tocaron: el agente empareja contra ellos y el índice único es (nombre_item, metodo) |
| Saludo, nombre y aviso de datos en el primer mensaje; siempre un estimado en dólares | Pedido el 2026-09-23. «A todo dice que en planta se confirma pero no da ni un valor aproximado» |
| Entrega 48-72 h · tarifa única de recogida y entrega $2,50 · recolección L-S · peso en libras, salvo las cortinas que van por kilo | Pedido el 2026-09-23. Todo vive en Configuración, no en el prompt |
| El negocio se llama **VIP Laundry** y el nombre sale de Configuración | Confirmado el 2026-09-23. Los prompts ya no lo llevan escrito |
| Cada prenda declara su método (agua/seco) | El agente proponía lavar un terno en agua. La lista del dueño ya traía el método de cada prenda |
| Tarifa de recogida y entrega y horario salen de Configuración | El dueño cambió el combo a $2,50 y el prompt tenía $5 escrito |
| OpenAI compartido con 321 | Temporal, acordado |
| Session pooler de Supabase | La conexión directa es solo IPv6 |

---

## 5. Fallos ya encontrados (no reintroducir)

- **El agente inventó una orden** («✅ Orden registrada», ID y monto falsos) sin
  llamar a la tool. Por eso existe la guardia de `Extraer JSON` y la regla de
  oro en el prompt de planta.
- **Una sola cobija se cotizaba a $12,00** (2026-09-21). El catálogo solo sabía
  cobrar por paquete cerrado y la lista del dueño dice «$5,00 c/u, 3 por
  $12,00». Se arregló con `precio_paquete` (migración 0009). Si vuelve a
  aparecer una promoción, va en esas dos columnas, nunca en el prompt.
- **Ofreció métodos (agua/seco/planchado) para ternos sin consultar el
  catálogo.** Regla en el prompt: nunca métodos ni opciones sin `cotizar_prendas`.
- **La suite borraba datos reales.** `operador.test.ts` usaba el número del
  dueño y le borraba la conversación. **Regla: ninguna prueba usa ni limpia un
  número real ni un valor que el dueño edita en el CRM**; cada corrida crea sus
  propios operadores y admins (`tests/util/corrida.ts`).
- **Pruebas atadas a la configuración de fábrica** (08:00, combo $5) fallaron
  cuando el dueño cambió Configuración. Ahora comparan contra la base.
- **Carrera entre pruebas por el precio del chal** (`servicios.test` lo cambia
  mientras `cotizar.test` lo usa). `cotizar.test` usa bufanda.
- Login roto por el token en el fragmento de la URL · bucle login↔panel por
  cookie caducada · pedido congelado sin poder cancelarse · «edredón 3 plazas»
  no se cotizaba · cajón móvil sin `translate-x` · Biome apagado al migrar ·
  corrida repetida cada 16,7 min · servidor zombi en el 3000 (`/api/health`
  reporta la fase compilada).
- **Reemplazos con `node -e` y `String.replace`** dañaron JSX (se comieron
  llaves). Para ediciones de TSX usa la herramienta Edit, no reemplazos masivos.

---

## 6. Lo temporal (hay que desmontarlo)

1. **Datos de ejemplo en la base real:** 24 clientes y 41 pedidos con teléfonos
   `+5932200…`. Se quitan con `pnpm db:demo --borrar` antes de operar en serio.
2. **n8n y Chatwoot compartidos con 321**, y la credencial de OpenAI también.
3. **Una sola base** para pruebas y producción.
4. **Contraseña provisional del superadmin**; alias `brncjn+admin@gmail.com`
   para el rol admin.
5. **Secretos que quedaron a la vista en el chat o en capturas** y conviene
   rotar: token de Vercel · verify token y secreto del webhook de Chatwoot ·
   **PIN de verificación en dos pasos del número (123456)**.
6. **Workflow viejo `ksk8bnj19phzMJHU`** desactivado y la **entrada del número
   de prueba** en Chatwoot: se pueden archivar.
7. `n8n/referencia/iAgente-321-INMO-V2.json` (versionado desde antes) trae un
   secreto literal de 321. No es nuestro para rotar; conviene sacarlo del repo.

## 7. Lo pendiente

**Esperando al dueño**
- **Plantilla `resumen_diario_admin`** (respaldo del resumen de las 8:00 para
  admins que no escribieron en 24 h): categoría Utilidad, idioma `es`, 7
  variables. El resumen ya está encendido; sin la plantilla, a quien esté
  fuera de ventana simplemente no le llega.
- **No hay ningún admin en la lista blanca** (solo Daniel Serrano, operador):
  hoy el resumen de las 8:00 no le llega a nadie. El dueño debe agregarse como
  Administrador y escribirle al agente al menos una vez al día.
**Por hacer**
- La dirección, el fijo y el saludo del agente siguen escritos en el prompt; el
  nombre del negocio ya sale de Configuración. Faltan campos en `configuracion`
  para los otros tres (el `saludo_agente` existe y está vacío).
- Validar la búsqueda de Chatwoot por teléfono (`src/lib/chatwoot.ts`,
  `/search?q=`) con la sesión del dueño.
- Repositorio en GitHub y CI (el remoto está configurado, falta crear el repo).
- Los E2E de Playwright **nunca se ejecutaron** (Chromium no descargó). No
  decir que están en verde.
- Segundo proyecto Supabase para producción; instancias propias de n8n/Chatwoot.
- `meta_referrals` para el referral de anuncios (ahora que hay número real).
- Aviso automático al cliente cuando hay discrepancia (hoy es manual).
- Pantalla para cerrar el mes de clientes `consolidado_mensual`.

---

## 8. Mapa del código que más se toca

| Qué | Dónde |
|---|---|
| Acciones del agente (webhook) | `src/server/webhook/schemas.ts` y `handlers/` (`cliente`, `pedidos`, `operador`, `planta`, `admin`, `reportes`, `permisos`) |
| Motor de precios | `src/server/pricing/cotizar.ts` (fuente única de verdad) |
| Dashboard y leads | `src/server/dashboard/repo.ts`, `leads.ts` · `src/app/(dashboard)/page.tsx` |
| Descargas CSV | `src/server/exportar/` · rutas `/clientes/exportar`, `/pedidos/exportar` |
| Lista blanca y niveles | `src/components/configuracion/lista-blanca.tsx` · migración `0007` |
| Enlaces a Chatwoot | `src/lib/chatwoot.ts` |
| Workflow n8n | `n8n/generador/*.cjs` → `n8n/workflows/laundry-vip-agente.json` |
| Datos de ejemplo | `scripts/demo-*.ts` (`pnpm db:demo`) |
