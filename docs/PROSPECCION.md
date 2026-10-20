# Prospección (negocios a quienes se les escribe primero)

Estado: construida y desplegada el 2026-10-20. **El envío automático está APAGADO** y no se
enciende hasta que Meta apruebe la plantilla `prospecto_primer_contacto` y el dueño lo decida.
Nadie ha recibido ningún mensaje.

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

## Antes de encender (checklist del dueño)

1. `pnpm tsx scripts/plantillas-meta.ts --estado` → `prospecto_primer_contacto` en **APPROVED**.
2. Arreglar la llave de Google y correr `pnpm db:prospectos-ubicar --confirmar` (así se evita escribirle a
   quien está lejos).
3. Dejar el tope en **5 por día** al inicio y mirar a los 2–3 días cuántos bloquean o responden NO. Un
   mensaje en frío desde el número definitivo puede bajar la calidad del WhatsApp del negocio en Meta si
   muchos lo bloquean; cada envío tiene costo.
4. Encender en Configuración → «Prospección automática».

## Pendiente (necesita el MCP de n8n, no disponible en la sesión que lo construyó)

- Que el prompt del agente sepa, cuando le escribe un prospecto, que es un negocio de la lista
  (nombre y segmento) para saludarlo por su nombre y no pedirle lo que ya se sabe.
- Que una respuesta «NO» a la plantilla se trate como `no_seguir` (hoy se atiende como mensaje normal y el
  agente ya tiene la tool `no_seguir`, pero no hay prueba con una frase real de prospecto).
- Que la dueña pueda preguntar «¿cómo va la prospección?» por WhatsApp (ampliar las consultas del admin).
- Prueba de punta a punta con un número propio (nunca real) cuando se encienda.
