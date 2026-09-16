# Plano del Proyecto — Lavandería VIP (La Kennedy, Quito)

> Documento de arquitectura consolidado. Producto de la fase de diseño con `/architect`.
> Sirve como base para generar el blueprint de construcción cuando se decida avanzar.

---

## 1. Resumen ejecutivo

Sistema de captación y operación de clientes B2B (clínicas, restaurantes, hoteles a 5km a la
redonda) para una lavandería de barrio, vía un agente de IA en WhatsApp que recibe pedidos desde
pauta de Meta Ads, cotiza y agenda la recolección/entrega, y opera junto a un CRM ligero para el
día a día en planta. Mantiene en paralelo a los clientes que van presencialmente al local — esos
se registran en el CRM por nota de voz del operador, sin fricción para él.

**Forma primaria:** automation-bot-integration (el agente/orquestador).
**Forma secundaria:** internal-tool (el CRM).

---

## 2. Independencia de infraestructura

Proyecto **100% independiente** del sistema 321 INMO existente. Sin recursos compartidos de
ningún tipo — n8n, Chatwoot, Supabase y Vercel son instancias/proyectos propios. Único punto en
común: ambos viven en la misma cuenta de Railway (solo facturación/organización).

| Servicio | Lavandería |
|---|---|
| CRM (frontend + API) | Vercel — proyecto propio |
| Base de datos + Auth | Supabase — proyecto propio |
| Orquestador | n8n — instancia propia en Railway |
| Inbox WhatsApp | Chatwoot — instancia propia en Railway |
| LLM | OpenAI API — mismas credenciales de cuenta, monitoreo de costo separado |

---

## 3. Stack técnico

- **CRM:** Next.js 16 + React 19 + TypeScript + Tailwind v4, sin ORM (Supabase JS client directo)
  — mismo esqueleto que `crm-321`, sin compartir código ni datos.
- **Auth:** Supabase Auth + tabla `staff` (roles owner/operador). Solo 2-3 usuarios, sin SSO.
- **Timezone:** helper Ecuador (UTC-5) copiado del patrón `dates.ts` de crm-321.
- **Contrato n8n↔CRM:** header `x-webhook-secret` (secreto propio, no compartido con 321).
- **Agente:** OpenAI `gpt-4.1-mini`, temperature 0, top_p 0.1, `response_format: json_object`,
  Tool First obligatorio — misma receta anti-alucinación que iAgente V2 de 321 INMO.
- **Transcripción de voz:** OpenAI Whisper (mismo proveedor, sin variable nueva).

---

## 4. El agente — dos modos

### 4.1 Modo cliente (número exclusivo del agente)

Atiende 24/7. Responde FAQ del local (horario, ubicación, precios generales) y gestiona todo el
flujo de recolección B2B/particular.

**Tools:**
- `Cotizar_Prendas(lista_prendas)` — recibe la lista detallada (`[{tipo, cantidad, detalle, metodo?}]`)
  y calcula el subtotal ítem por ítem contra el catálogo (tabla `services` en el CRM — ver Anexo A).
  Cada entrada del catálogo declara su propia unidad (pieza / libra / kilo / m²) y, si tiene más de
  un método posible, lo marca para que el agente pregunte (regla 5). Si un tipo no está catalogado,
  **no inventa un precio** — lo marca "a confirmar por el operador" y sigue con el resto de la lista.
  El subtotal se presenta siempre como **estimado**, pendiente de confirmación en planta (ver 4.3)
- `Calcular_Vehiculo(numero_fundas)` — 1 funda de basura = moto, más de 1 = auto. Devuelve el
  estimado de costo de **recolección vía apps** (siempre a cargo del cliente cuando la lavandería
  la gestiona — no aplica si el cliente usa transporte propio)
- `Obtener_Proxima_Ventana_Disponible()` — según horario real de recolección configurado; si el
  cliente escribe fuera de horario, igual se le cotiza y agenda para la primera ventana válida
- `Crear_Pedido` — solo tras confirmación explícita del cliente sobre el resumen total. Antes de
  crear, presenta las 2 opciones de entrega (combo $5, o a la carta con costo real por tramo — ver
  sección 7); si elige a la carta, pregunta el método de cada tramo (transporte propio o vía apps a
  su costo); si algún tramo va vía apps, pregunta si prefiere pagar de inmediato o después (con el
  límite de que debe confirmarse antes del despacho); guarda la lista declarada con timestamp
  (`lista_declarada`) y las elecciones de entrega/pago
- `Consultar_Estado_Pedido` — el cliente puede preguntar "¿cómo va mi pedido?" en cualquier momento

**Reglas clave:**
1. Leer memoria siempre — anti-redundancia
2. Tool First — nunca inventa precio ni tiempo de entrega
3. Recolecta en orden: **lista detallada de prendas** (tipo + cantidad + detalle — ej. "5
   camisetas, 4 pantalones jean azul, 1 chaqueta de lana") → cantidad aproximada en fundas (dato
   aparte, solo para el vehículo) → dirección → nombre de contacto → (cliente nuevo) nombre/tipo de
   negocio
4. Cotiza total = subtotal por prenda estimado (`Cotizar_Prendas`) + costo de recolección, siempre
   con ventana horaria real. **El costo del lavado queda sujeto a confirmación en planta** — el
   agente siempre lo aclara así, nunca lo presenta como un monto definitivo
5. **Si la prenda tiene más de un método de lavado en el catálogo** (solo aplica a camisa/blusa y
   camiseta — ver Anexo A), pregunta cuál prefiere el cliente (seco / agua / solo planchado) antes
   de cotizar ese ítem — nunca asume. El resto del catálogo tiene un único método, no se pregunta.
6. Ítems con precio por rango (peluches) o por libra/kilo a granel (ropa suelta, cortinas) se
   cotizan como **estimado** — el resumen lo indica explícitamente y el monto final se confirma en
   la verificación de planta (ver 4.3)
7. **Confirmación explícita obligatoria** antes de `Crear_Pedido` — el resumen repite la lista
   completa de prendas, el estimado de lavado (aclarando que se confirma en planta), y presenta las
   2 opciones de entrega (sección 7) con su costo correspondiente antes de que el cliente confirme
8. Recomienda (no obliga) que el cliente envíe una foto de las prendas antes de cerrar la funda —
   queda como evidencia con timestamp en el pedido, protege a ambas partes ante un reclamo
9. `ESCALAR_HUMANO` con whitelist cerrada de frases (evita falsos positivos)
10. Contexto de anuncio Meta (objeto `referral` de Click-to-WhatsApp) personaliza el saludo inicial
11. Cliente recurrente no repite preguntas ya respondidas
12. Tono "usted", profesional — público B2B
13. Aviso corto de privacidad de datos en el primer contacto con un cliente nuevo (cumplimiento LOPDP)
14. Entiende "cancela mi pedido" como comando válido

### 4.2 Modo operador (números en whitelist — empieza con 1, hasta 2-3)

Acepta voz, texto o imagen. Copiloto interno — nunca borra datos, eso requiere el CRM directo.

**Tools:**
- `Registrar_Cliente_Presencial` — crea cliente + pedido `canal: presencial` (sin dirección/vehículo)
- `Actualizar_Registro` — corrige el último registro si la transcripción salió mal (el operador
  responde por texto y el agente actualiza, no duplica)
- `Generar_Reporte` — ingresos del período, pedidos pendientes, pedidos por tipo de cliente B2B
- `Consultar_Pedido` — estado de cualquier pedido por nombre/teléfono
- `Confirmar_Pago(pedido, tramo)` — marca un tramo de cobro como pagado (ej. "confirma pago del
  pedido de la Clínica X") — es lo que libera `esperando_pago_para_entrega` y permite despachar el
  mensajero de regreso. Es una actualización de estado, no una eliminación — dentro del límite ya
  establecido de que el modo operador nunca borra datos
- `Corregir_Cotizacion(pedido, monto_corregido, motivo)` — corrige el monto de **cualquier**
  pedido (no solo el último registrado) cuando el agente cotizó mal — catálogo mal aplicado, método
  seco/agua confundido, cálculo incorrecto. Dispara automáticamente la notificación al cliente con
  el valor corregido (ver 4.3). Disponible por WhatsApp o directo en el Detalle de pedido del CRM

### 4.3 Verificación y corrección — cantidad y cotización

Dos tipos de problema, mismo mecanismo de resolución. Ninguno se descubre después de lavar, cuando
ya es la palabra de uno contra la del otro.

**A) Discrepancia de cantidad.** Un cliente dice que mandó 10 prendas, llegan 8, y reclama después
del lavado. Checkpoint obligatorio:
1. La lista declarada por el cliente queda registrada con timestamp desde `Crear_Pedido`
   (`lista_declarada`) — es la única versión "oficial" hasta que se verifique
2. Foto opcional del cliente antes de sellar la funda (`foto_pre_recoleccion_url`) — evidencia
   adicional, se ofrece siempre, no es obligatoria
3. **Al llegar el pedido a planta, el operador cuenta las prendas contra la lista declarada ANTES
   de empezar a lavar** — checklist simple en el CRM (marca cada ítem recibido/faltante), se guarda
   como `lista_verificada`

**B) Error de cotización del agente.** El agente puede cotizar mal — catálogo mal aplicado, método
seco/agua confundido, cálculo incorrecto. El operador (o el dueño, desde cualquier pantalla del
CRM) corrige el monto de **cualquier** pedido, no solo en el momento de la verificación, con
`Corregir_Cotizacion(pedido, monto_corregido, motivo)`.

**En ambos casos:**
4. El pedido se marca `discrepancia_detectada` (cantidad, precio, o ambos) y **no se cobra el monto
   original** — nunca se cobra lo que dijo el agente si un humano lo corrigió
5. El agente **notifica automáticamente al cliente** el valor final corregido y confirmado, con el
   motivo del ajuste, ANTES de pedir el pago — ej. "Ajustamos tu cotización: el monto correcto es
   $X (antes decía $Y) porque [motivo]. ¿Todo bien así?"
6. El pedido no avanza a `en_proceso` (ni se despacha si ya estaba listo) con una discrepancia sin
   resolver — requiere confirmación del cliente o cierre manual del operador

Esto mueve el punto de verificación a *antes de cobrar y antes de lavar*, cuando todavía se puede
hacer algo.

---

## 5. Workflow n8n (nodos)

1. Webhook Trigger — `message_created` de Chatwoot
2. Filtro: mensaje entrante válido (no nota privada, no eco del bot)
3. Debounce (~30s) — agrupa mensajes rápidos del mismo contacto
4. IF: ¿remitente en whitelist de operadores? → rama 4.2, si no → rama 4.1
5. Buscar/crear cliente — HTTP al CRM (`x-webhook-secret`)
6. Cargar memoria de conversación (Postgres/Supabase, por `conversation_id`)
7. Nodo agente OpenAI correspondiente (cliente u operador)
8. Extraer respuesta (Code node, parseo JSON con try/catch)
9. IF: ¿acción a ejecutar? (pedido creado / registro presencial / reporte)
10. Notificación dual de pedido nuevo: WhatsApp al operador + `status: 'nuevo'` resaltado en CRM
11. Preparar solicitud de despacho — **solo si el tramo es `app` y ya está `pagado`**; si es
    `propio_cliente` no aplica, y si es `app` sin pago confirmado el pedido queda en
    `esperando_pago_*` y no se genera la solicitud (texto/deep-link para Uber/mensajería local)
12. Responder al remitente vía Chatwoot API
13. Idempotencia — `dedupe_key` = `message_id` de Chatwoot

---

## 6. CRM — pantallas

| Pantalla | Función |
|---|---|
| Cola de hoy (home) | Pedidos con ventana de HOY, ordenados por hora — el operador ejecuta en orden a primera hora |
| Pedidos (todos) | Historial completo, filtros por estado/canal/cliente/fecha |
| Detalle de pedido | Datos + línea de tiempo de estados + notas + cobro |
| Clientes | B2B y presenciales, tipo de negocio, historial, modelo de cobro, saldo pendiente |
| Servicios (catálogo) | CRUD de precios — alimenta `Catalogo_Servicios` |
| Configuración | Horarios, estimados de delivery moto/auto, whitelist de operadores — alimenta las tools de agenda |
| Reportes | Ingresos, pedidos por tipo de cliente — mismo dato que `Generar_Reporte` expone por WhatsApp |

**Ciclo de vida del pedido:**
`nuevo → (si aplica: esperando_pago_para_recoleccion) → recolectado → (verificación de conteo) →
en_proceso → listo_para_entrega → (si aplica: esperando_pago_para_entrega) → entregado`
Estados adicionales: `cancelado`, `recoleccion_fallida`, `discrepancia_detectada` (bloquea el avance
a `en_proceso` hasta resolverse). Los dos estados `esperando_pago_*` solo aplican al tramo cuyo
método de transporte es `app` — bloquean la solicitud de ESE vehículo hasta que el operador (o
`Confirmar_Pago`) marque el tramo como pagado. Con transporte propio del cliente, esos estados no
existen — es cobro cara a cara.

**Estado de pago ya no es un solo campo** — son tres, uno por tramo de cobro (ver sección 7):
recolección, lavado y entrega. Necesario porque cada tramo se cobra en un momento distinto, y el
cobro consolidado mensual deja el tramo de lavado en `acumulado_mensual` mientras recolección y
entrega (si aplica) ya se resolvieron por separado.

**Detalle de pedido** incluye ahora: lista declarada (ítem por ítem), lista verificada en planta,
foto pre-recolección si el cliente la envió, `tipo_entrega` (`combo` / `a_la_carta`), y para cada
tramo un `metodo_transporte` (`app` / `propio_cliente` — en `combo` ambos tramos son siempre `app`).
Desglose de cobro por tramo: `pago_recoleccion` y `pago_entrega` (monto según tipo/método,
pagado/pendiente/n/a si transporte propio, que se paga cara a cara), `pago_lavado` (estimado →
confirmado tras verificación; pagado/pendiente/acumulado_mensual). Cuando el método de un tramo es
`app`, **ese tramo debe estar `pagado` antes de despacharlo** (salvo cliente consolidado mensual) —
el botón "confirmar pago" de esta pantalla es lo que libera `esperando_pago_para_entrega`.

---

## 7. Modelo de negocio — decisiones financieras

**Dos tipos de entrega — el cliente elige uno por pedido. El negocio nunca cubre fletes, siempre los
paga el cliente; lo que cambia es cuánta gestión asume cada uno.**

### Tipo A — Delivery combo ($5, "camino fácil")
La lavandería gestiona y paga (con su propia cuenta Uber/mensajería) ambos tramos — recolección y
entrega. El cliente paga un **flat $5 total** que cubre ambos tramos sin importar el costo real de
cada viaje, más el costo del lavado. Cero gestión de logística para el cliente: solo envía y recibe.

### Tipo B — A la carta ("el cliente cubre el costo real de cada tramo")
Para **cada tramo por separado** (recolección y entrega), el cliente elige entre:
- **Transporte propio** — manda su propio motorizado, carro o persona a recoger/entregar en la
  planta. La lavandería no paga ni gestiona nada — solo recibe o entrega el bulto a quien llegue.
- **Vía apps, a su costo real** — la lavandería solicita el vehículo (Uber/mensajería) igual que en
  el combo, pero factura el costo real 100% al cliente, sin el descuento implícito del flat $5.

Puede terminar costando más que el combo — ese es el trade-off explícito que el cliente acepta a
cambio de flexibilidad (o de ahorrar usando su propio transporte).

**Secuencia operativa (aplica a ambos tipos):** la lavandería recibe → verifica la orden (sección
4.3) → lava → arma el envío de vuelta → **notifica al cliente si tiene pago pendiente** → según el
tipo/método elegido, solicita el vehículo o espera al transporte que envíe el cliente.

**Regla de pago — no se despacha ningún tramo, ni recolección ni entrega, sin su pago confirmado.**
Aplica siempre que es la lavandería quien solicita el vehículo (combo, o "a la carta vía apps"):
1. **Pago inmediato** — el cliente paga apenas se confirma el pedido (o ese tramo específico),
   agiliza el despacho.
2. **Pago después, con límite** — puede esperar, pero debe confirmarse antes de que el operador
   solicite ese vehículo. El pedido/tramo queda en `esperando_pago_para_recoleccion` o
   `esperando_pago_para_entrega` hasta que el operador (o el agente vía `Confirmar_Pago`) lo marque
   pagado — nunca se pide el mensajero mientras el tramo siga sin pago confirmado.

En el **combo**, el $5 se paga completo antes de despachar la recolección — cubre ambos tramos de
una sola vez, no se divide. En **a la carta vía apps**, cada tramo se paga por separado, justo antes
de despachar ese tramo específico.

Cuando el transporte de un tramo es **propio del cliente**, no aplica este bloqueo — es un
intercambio cara a cara en planta, se cobra en ese momento sin el riesgo de mandar un mensajero con
el bulto sin haber cobrado.

**Excepción:** clientes B2B con cobro consolidado mensual no pagan por pedido individual bajo
ninguna modalidad — se acumula en su cuenta y se liquida a fin de mes, sin bloquear ningún despacho.

**Costo del lavado:** el agente lo cotiza como estimado; queda confirmado como monto final solo
cuando el operador verifica en planta (sección 4.3).

**Cancelación:** sin costo si se cancela antes de pagar/despachar el vehículo de recolección (tramo
vía apps). Si ese tramo ya se pagó y se despachó, el pago no se reembolsa — como ahora nunca se
despacha sin pago confirmado (regla de arriba), en la práctica esto solo puede pasar después de que
el cliente ya pagó, así que no hay escenario de "despachar sin cobrar". El pedido igual necesita un
campo de estado para distinguir "antes" de "después" del despacho.

**Facturación:** el CRM solo lleva registro interno de monto y estado de pago, por tramo. La
factura electrónica SRI se sigue emitiendo aparte con el sistema contable actual — fuera de v1.

---

## 8. Cumplimiento y control de costo

- Aviso corto de privacidad de datos en el primer contacto (LOPDP Ecuador).
- Tope diario de mensajes por número + alerta de costo de OpenAI — control de abuso/spam.
- Verificación de negocio en Meta Business Manager y plantillas pre-aprobadas para mensajes fuera
  de la ventana de 24h ("tu ropa está lista", recordatorios) — acción de construcción, antes de
  lanzar pauta a volumen.
- Heartbeat/alerta si el agente deja de procesar eventos — nadie está mirando el sistema todo el día.

---

## 9. V1 incluye / no incluye

**Incluye:** intake conversacional 24/7 B2B + particular, **lista detallada de prendas con
cotización ítem por ítem**, delivery dividido (recolección cobrada, entrega gratis), agenda dentro
de horario real, regla de vehículo por volumen (fundas), **verificación de conteo en planta
anti-disputas**, registro presencial por voz del operador, modo operador con reportes, notificación
dual de pedido nuevo, CRM completo con cola operativa, cobro mixto, cancelación con cargo
condicional, aviso de privacidad, control de costo.

**No incluye:** facturación electrónica SRI, despacho 100% automático vía API de courier (sin
proveedor confirmado en Ecuador), pasarela de pago online, roles/SSO más allá de owner+operador,
POS de mostrador, geovalidación automática del radio de 5km, enrutamiento/batching de múltiples
recolecciones en un mismo viaje, reconocimiento automático de tipos de prenda no catalogados (esos
quedan "a confirmar por el operador", nunca se inventa un precio).

---

## 10. Preparación para reventa como comercializadora digital (futuro, no v1)

Diseñar desde ya con esto en mente, sin construirlo todavía:
- Configuración por variables (nunca hardcodear nombre/catálogo/horario de un cliente)
- Prompt del agente como plantilla con placeholders
- Este mismo cuestionario operativo como parte del onboarding de cada cliente nuevo
- Runbook de instalación paso a paso
- Eval set de 15-20 conversaciones de prueba
- Documentación tipo `CLAUDE.md`/`CHECKPOINT.md` por cada instalación

---

## 11. Riesgo principal

Que el LLM extraiga bien dirección/cantidad/servicio de un chat libre en español — mitigado con
Tool First, confirmación explícita antes de crear el pedido, y la receta ya probada en producción
en 321 INMO (300+ iteraciones ya pagadas por otro proyecto).

---

## 12. Pendiente antes de construir

- Cuestionario operativo (`CUESTIONARIO_OPERADOR_PLANTA.md`) lleno por el operador y el dueño —
  calibra horarios, radio de cobertura, y confirma el catálogo del Anexo A.
- Verificación de negocio en Meta Business Manager.
- Decisión de nombre/marca del agente frente al cliente.

---

## Anexo A — Catálogo de servicios

Transcrito de la lista de precios física de la planta (fuente real, no estimado). Esta es la
semilla inicial de la tabla `services` en el CRM. Dos entradas de la letra manuscrita se
interpretaron por contexto — **confirmar con el dueño al llenar el cuestionario**: "POITDION TERNO"
→ *Pantalón terno*, "CHDL" → *Chal*.

### A.1 Alfombras — por m²

| Tipo | Precio |
|---|---|
| Pelo corto | $7.00/m² |
| Pelo alto | $8.00/m² |

### A.2 Lavado en seco — por pieza (método único, no se pregunta)

| Prenda | Precio |
|---|---|
| Terno 3 piezas | $8.50 |
| Terno 2 piezas (hombre/mujer) | $7.50 |
| Saco terno | $3.75 |
| Pantalón terno | $3.75 |
| Abrigo liviano o gabardina | $5.50 |
| Abrigo pesado | $7.50 |
| Chal | $3.00 |
| Chaleco (plumón o lana) | $3.50 |
| Chompa | $5.50 |
| Chompa de cuero | $8.00 |
| Falda corta | $3.50 |
| Falda larga | $4.50 |
| Mandil | $4.00 |
| Mantel pequeño | $3.50 |
| Mantel mediano | $4.00 |
| Mantel grande | $5.00 |
| Vestido corto | $5.00 |
| Vestido largo de fiesta | $7.00 |
| Vestido primera comunión | $6.00 |
| Vestido de novia sencillo | $20.50 |
| Vestido de novia con cola | $25.50 |
| Enterizo | $5.00 |
| Edredón (plumas o en seco) | $8.00 |
| Tinturado (teñido) | $6.00 |

### A.3 Prendas con doble/triple método — el agente SIEMPRE pregunta cuál prefiere el cliente

| Prenda | Solo lavado (agua) | Completo en seco | Solo planchado |
|---|---|---|---|
| Camisa / blusa | $2.25 | $2.50 | $1.70 |
| Camiseta | $2.25 | $2.50 | — |

### A.4 Ropa suelta sin catalogar — por libra (lavado en agua a granel)

Para ropa común (uniformes, ropa de trabajo genérica) que el cliente no describe pieza por pieza,
sino que manda en volumen.

| Servicio | Precio |
|---|---|
| Lavado + secado + doblado | $0.70/libra |
| Solo lavado | $0.35/libra |
| Solo secado | $0.35/libra |

### A.5 Cortinas — por kilo

| Tipo | Precio |
|---|---|
| Visillos | $3.00/kilo |
| Pesadas | $3.50/kilo |

### A.6 Ropa de cama, hogar y otros — por pieza (con variantes)

| Ítem | Precio |
|---|---|
| Pantalón (no terno) | $3.00 |
| Sueter de lana | $2.50 |
| Gorro | $2.50 |
| Bufanda | $3.00 |
| Mochila pequeña | $3.50 |
| Mochila grande | $5.00 |
| Almohada | $3.00 |
| Cojín | $2.50 |
| Edredón 2 piezas | $5.00 |
| Edredón 2½ piezas | $6.00 |
| Edredón 3 piezas | $7.00 |
| Duvet | $5.00 |
| Cobijas pequeñas | 3 x $12.00 (paquete) |
| Juego sábanas + 2 fundas | $5.00 |
| Zapatos deportivos | $3.00/par |
| Peluche grande | $5.00 – $7.00 *(rango — confirmar tamaño exacto en planta)* |
| Peluche mediano | $3.00 |
| Peluche pequeño | $1.00 – $2.50 *(rango — confirmar tamaño exacto en planta)* |

**Nota de diseño:** los ítems con precio en rango (peluches) o por libra/kilo a granel (A.4, A.5) se
cotizan al cliente como estimado explícito — el monto final queda sujeto a la verificación de conteo
en planta (sección 4.3), igual que una discrepancia de cantidad.
