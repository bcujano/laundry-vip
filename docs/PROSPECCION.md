# Prospección (negocios a quienes se les escribe primero)

Estado al 2026-10-20: construida, desplegada y **encendida por el dueño** (interruptor «Prospección
automática» en Configuración, tope 10 por día). Plantilla `prospecto_primer_contacto` APROBADA por Meta,
ubicación con Google Maps hecha y agente publicado. Los primeros envíos salen a las 10:00 (lunes a sábado)
por el carril de plantillas de n8n; al cierre de esa sesión aún no había salido ninguno
(0 filas en `plantillas_enviadas`).

## Qué es y qué no es

- Un **prospecto** es un negocio de la lista de ProspectorVIP que **nunca nos ha escrito**. Un *lead* es
  alguien que sí escribió al agente (tabla `conversaciones`). Por eso viven en tablas separadas:
  mezclarlos inflaba las métricas de «clientes nuevos».
- La etapa del prospecto **no se guarda**: se deriva al leer (`src/server/prospectos/etapa.ts`):
  `nuevo` → `contactado` (se le mandó la plantilla o se marcó a mano) → `respondio` (hay una
  `conversacion` con su teléfono) → `cliente` (hay un `cliente`, y con pedido cuenta como cliente de
  verdad). `descartado` y `no_contactar` sí se guardan. Quien responde lo atiende el agente como a
  cualquier lead; el webhook no cambió.

## Datos y carga

- Tabla `prospectos` (migración 0029). Teléfono: se usa la columna **Teléfono** de la hoja; la columna
  WhatsApp es inconsistente y se ignora.
- Segmentos de trabajo (los que marcó el dueño): catering · centros de convenciones · salones de eventos ·
  geriátricos · hogares de ancianos · tiendas de alquiler de ropa (y sus combinaciones en una celda).
- Carga (idempotente por fuente + número de la hoja; no importa a quien ya es cliente, lead o del equipo):

  ```bash
  python scripts/prospectos_xlsx_a_json.py "ProspectorVIP LAUNDRY.xlsx" prospectos.json
  pnpm db:prospectos prospectos.json              # simula
  pnpm db:prospectos prospectos.json --confirmar  # escribe
  ```

- Cargados en producción: **79**. Celulares escribibles, **fijos** (16: se llaman, filtro «Por llamar» en el
  CRM) y **sin teléfono** (6: Instagram o correo).
- `pnpm db:reset-clientes` **no** toca `prospectos`.

## Quién queda elegido para escribirle (`src/server/prospectos/elegir.ts`)

Solo si cumple todo: etapa `nuevo`; teléfono **celular**; cobertura distinta de `fuera`; no es del equipo,
cliente, ni alguien que ya escribió; no está en `no_seguir`; no recibió plantilla en los últimos 25 días;
**nunca antes** se le mandó el primer contacto (una sola vez en la vida); y no se pasa del tope diario
(`prospeccion_limite_diario`, 10 por defecto, 1–50, menos lo ya enviado hoy). Orden: dentro → dudoso →
sin ubicar, luego más cerca, más reseñas, nombre.

## Cómo sale el mensaje

Mismo carril que la reactivación de clientes, **sin tocar n8n**: `Plantillas 10:00` (L–S) →
`plantillas_pendientes` → Meta → `marcar_plantilla` (que marca al prospecto como `contactado`).

- Interruptor propio: `prospeccion_automatica` (Configuración → «Prospección automática»), distinto de
  `plantillas_automaticas` (clientes). Con ambos apagados `plantillas_pendientes` devuelve `envios: []`
  (verificado en producción el 2026-10-20).
- Plantilla `prospecto_primer_contacto` (MARKETING, es), enviada a revisión el 2026-10-20. Estado:
  `pnpm tsx scripts/plantillas-meta.ts --estado`. Variables: {{1}} nombre del negocio (limpio, ≤60) y
  {{2}} qué se le ofrece lavar según el segmento. **No promete recogida ni plazos** (la mayoría no se pudo
  ubicar dentro de los 2,5 km); ofrece la lista de precios; pide responder NO para no recibir más.

## Ubicación (cobertura)

`dentro` / `dudoso` / `fuera` / `sin_ubicar` por distancia a la planta con el radio de Configuración (2,5 km),
con margen de 0,7 km si solo se ubicó el barrio y de 0,3 km si se ubicó la calle. Solo sirve para **ordenar** y
para **no escribirle a quien está claramente fuera**; el agente verifica la cobertura real cuando el prospecto
da su dirección.

Con OpenStreetMap quedaron 52 de 79 «sin ubicar» (no conoce muchas calles de Quito). Con la llave de Google
arreglada (E11 en CONTINUIDAD):

```bash
pnpm db:prospectos-ubicar              # simula (dice qué proveedor usa y por qué)
pnpm db:prospectos-ubicar --confirmar  # escribe cobertura y distancia
```

Ubicación hecha con Google el 2026-10-20: 61 dentro, 11 en el borde y 7 fuera (de 79). Si cambia la planta o el
radio, `pnpm db:prospectos-ubicar --todos --confirmar` la repite.

## Bitácora de contactos (migración 0030)

Cada contacto con un prospecto queda anotado en `prospecto_contactos` (una fila por hecho, nunca se edita):
el mensaje en frío por plantilla (automático, lo escribe `marcar_plantilla`), las llamadas y mensajes que el
equipo registra a mano con el formulario «Registrar contacto» de cada fila, las notas, los cambios de estado y
las bajas («no contactar», también cuando el prospecto se lo pide al agente). Lo que el agente hace después de
que el prospecto responde no se duplica: al leer se junta con `conversaciones` (cuándo escribió) y
`seguimientos` (cada seguimiento automático). Se ve en `/prospectos` (último movimiento por negocio) y en
`/prospectos/historial` (todo, con filtros por tipo y negocio). Código: `src/server/prospectos/bitacora.ts`.

### Y en Chatwoot

Cada línea de la bitácora se copia como **nota privada** en la conversación de Chatwoot del prospecto (cuenta 3,
bandeja de WhatsApp); si no hay contacto o conversación, se crean (sin enviar nada). Así quien atiende la
bandeja ve la historia de la prospección junto a los mensajes. Es de mejor esfuerzo: si Chatwoot falla, la
bitácora del CRM igual queda. Código: `src/server/chatwoot/notas.ts`; usa `CHATWOOT_BASE_URL`,
`CHATWOOT_ACCOUNT_ID` y `CHATWOOT_API_TOKEN` en Vercel (el token es de Byron ADMIN; se niega a operar fuera de la
cuenta 3). Las notas privadas no pausan al agente. Las pruebas no escriben en Chatwoot (`VITEST`).

## Cómo se vigila ahora que está encendida

1. Al día siguiente de los primeros envíos: `/prospectos` (filtros «Contactados» y «Respondieron») y
   `pnpm chatwoot:revisar --desde AAAA-MM-DD`.
2. Si varios responden NO o bloquean el número, bajar el tope en Configuración (recomendado: 5 por día al
   inicio) o apagar el interruptor. Un mensaje en frío desde el número definitivo puede bajar la calidad del
   WhatsApp del negocio en Meta; cada envío tiene costo.
3. Los envíos reales quedan en `plantillas_enviadas` (plantilla `prospecto_primer_contacto`, clave = id del
   prospecto).

## Lo que ya hace el agente con un prospecto (verificado en producción el 2026-10-20)

- `verificar_whitelist_operador` devuelve `prospecto: {nombre, segmento, ya_se_le_escribio}` (o `null`) y el
  prompt del agente de clientes lo usa.
- Un «NO» seco como primer mensaje: el agente llama `no_seguir`, se despide y el prospecto pasa a «no
  contactar». Se simuló con un teléfono ficticio por la bandeja API de pruebas (`scripts/simular-cliente.ts`) y
  se limpió después.
- Un «NO» en medio de una conversación, como respuesta a una pregunta del agente, se interpreta como respuesta
  a esa pregunta y no como baja: es el comportamiento correcto.
- La dueña puede preguntar «¿cómo va la prospección?»: `consulta_admin` con `prospeccion` (cifras sin
  teléfonos).

## Pendiente

- Tras un «NO» el flujo igual manda la imagen del catálogo (se envía en el primer contacto de toda
  conversación nueva). Conviene saltársela cuando el agente llamó `no_seguir`; es un cambio en n8n.
- Verificar el primer lote real de punta a punta (plantilla → Meta → `marcar_plantilla`) en
  `plantillas_enviadas` y `/prospectos`.
