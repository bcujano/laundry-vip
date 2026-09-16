# Estado y continuidad

Última actualización: **2026-09-16**. Este documento es el traspaso entre
sesiones. Si acabas de entrar, léelo entero antes de escribir código.

---

## 1. Dónde estamos

El CRM **está construido, probado y en producción**. Las 14 fases del plan
original están cerradas, más un rediseño completo pedido después.

| | |
|---|---|
| Producción | **https://laundry-vip.vercel.app** (proyecto Vercel `laundry-vip`) |
| Base de datos | Supabase `cvdlslltevwxprdktmfu`, región São Paulo |
| Repo | local en `C:\dev\laundry-vip`, **sin remoto todavía** |
| Pruebas | **207 en verde** · typecheck, lint y build limpios |
| Commits | 19, uno por fase más el rediseño |

### Entrar al CRM

```
correo:     brncjn@gmail.com
contraseña: tQTQRBcfVdzFnwUc     ← provisional, la puse yo; hay que cambiarla
```

Roles: `superadmin` (brncjn@gmail.com) · `admin` (brncjn+admin@gmail.com, alias
de prueba) · `operador` (dcwacks.89@gmail.com).

---

## 2. Qué hay construido

**CRM** — Dashboard con KPIs y panel de «requiere atención», Cola de hoy,
Pipeline arrastrable, Pedidos con detalle (verificación de conteo, cobros,
correcciones), Clientes con ficha e historial, Servicios (54 filas), Reportes,
Configuración y Usuarios. Barra lateral oscura a la izquierda, responsive.

**Backend del agente** — `POST /api/webhook`, un solo endpoint, secreto por
cabecera comparado con `timingSafeEqual` antes de leer el cuerpo. **15 acciones
implementadas.** Motor de precios (`src/server/pricing/cotizar.ts`) como fuente
única de verdad.

**Base** — 14 tablas con RLS negando por defecto, 6 migraciones, catálogo de 54
filas sembrado de forma idempotente.

### Reglas de negocio que ya están codificadas y probadas

- Todo monto del agente es **estimado pendiente de verificación**. El operador
  cuenta las prendas en planta antes de lavar.
- **Discrepancia = bloqueo + notificación.** Un conteo que no cuadra congela el
  pedido; solo se puede cancelar hasta resolverla. El monto viejo nunca se
  vuelve a cobrar.
- Ítems con varios métodos (camisa/blusa, camiseta) **piden el método**, sin dar
  precio. Los dos peluches viajan como **rango**, sin elegir un extremo.
- Si varias prendas del catálogo encajan («un edredón»), **pregunta cuál**.
- Nunca se despacha un tramo «app» sin su pago confirmado. Excepción única:
  clientes `consolidado_mensual` nunca nacen esperando pago.
- El agente **nunca rechaza por horario**: ofrece la siguiente ventana válida.
- Las fundas son solo para elegir vehículo (1 → moto, más → auto). Nunca se
  mezclan con la lista de prendas.

### Horario sembrado

Lunes a sábado · recolección 08:00–12:00 · margen 30 min · última orden del
mismo día 11:30 · apertura 08:00, cierre 17:00.

> ⚠️ **Sin resolver:** Google Maps dice que el local abre a las **8:30**, no a
> las 8:00. Hay que preguntarle al dueño cuál es el bueno y corregir
> `configuracion` si hace falta.

---

## 3. La tarea en curso: el agente en n8n

Está **todo decidido y nada ejecutado**. El dueño dio el visto bueno al plan.

### La decisión que manda sobre todas

**No se clona desde cero: se parte del workflow que ya funciona.**

El dueño entregó `iAgente 321 INMO V2.json` (80 nodos, en su Downloads; también
está en su n8n con id `kdtUTHuszghCNPQ1`). Su instrucción textual:

> *"el workflow del agente no debe ser generado desde cero, tomamos la
> referencia agente 321 y solo ajustamos a lavandería vip, no quiero cambiar
> estructura ni funcionalidad. Se mantiene todo lo que sea útil para laundry,
> lo que se elimina es lo específico de 321."*

### Regla imperativa

> *"una vez que ejecutemos no tocamos nada de 321, no modificamos nada, hacemos
> un espacio para laundry vip y que funcione sin pasar ni tocar nada de 321 eso
> es imperativo."*

**Por qué importa y no es obvio:** en Chatwoot los webhooks se configuran **por
cuenta, no por inbox**, y el filtro del workflow de 321 es solo
`event == message_created AND message_type == incoming` — **no filtra por
inbox**. Si Lavandería VIP viviera en la cuenta 1, cada mensaje de la lavandería
dispararía también al agente inmobiliario. Por eso se creó la **cuenta 3**.
Arreglarlo con un filtro en el workflow de 321 significaría modificarlo, que es
justo lo prohibido.

### Arquitectura (la del 321, que ya funciona)

```
Meta app 321  → Chatwoot cuenta 1 → webhook → workflow 321       (NO TOCAR)
Meta app LVIP → Chatwoot cuenta 3 → webhook → workflow LVIP      (lo nuevo)
```

El referral de Meta Ads no llega por Chatwoot: lo guarda un workflow aparte en
Postgres (`meta_referrals`) y el agente lo consulta por teléfono. Son dos apps
de Meta suscritas a la misma WABA.

### Datos ya confirmados

| Dato | Valor |
|---|---|
| Chatwoot | `https://chatwoot-production-8564.up.railway.app` · **cuenta 3** |
| Inbox | «Laundry VIP», canal WhatsApp Cloud |
| Número de prueba | `+1 555 156 4767` |
| Phone number ID | `502312282974917` |
| WABA ID | `499018113304409` |
| URL de webhook | `https://chatwoot-production-8564.up.railway.app/webhooks/whatsapp/+15551564767` |
| CRM | `https://laundry-vip.vercel.app/api/webhook` |
| Local | Laundry Vip · De los Pinos y Pedro Barrios, La Kennedy · `VG69+M8J, 170138 Quito` |
| Coordenadas | `-0.1382973, -78.4820373` |
| Fijo del local | (02) 281-0815 |

Los secretos (tokens de Chatwoot, Meta y el verify token) están en `.env.local`,
que está fuera de git. **Nunca los escribas en el repo ni en el JSON del
workflow**: van como variables de entorno de la instancia de n8n.

### Triaje acordado: 80 nodos → ~47

**Se queda intacto** (la fontanería probada del 321):
`Chatwoot Webhook` · `Filtro Chatwoot` · `Filtro Humano` · `WhatsApp Inicio` ·
`Agregar Referral` · `Debounce` · `Obtener Ultimos Mensajes` ·
`Es Ultimo Mensaje?` · `Combinar Textos` · `Tipo de Mensaje` · `Espera Texto` ·
`Preparar Mensaje Final` · `Calculator` · `Necesita Humano?` ·
los 4 nodos de **recepción de imágenes** · los 3 de **Enviar Ubicación**.

> El debounce del 321 es mejor de lo que parece: espera, **vuelve a leer** los
> mensajes de Chatwoot y aborta si el suyo ya no es el último entrante. Además
> junta los mensajes sueltos desde la última respuesta. No lo simplifiques.

> `Extraer Imagen - OLD` es un parser robusto del JSON del modelo (aguanta
> comillas curvas, BOM, fences de markdown, JSONs pegados). **Se conserva tal
> cual**, solo se renombra a `Extraer JSON`.

**Se adapta** (mismo nodo, otro dato):

| Nodo | Cambio |
|---|---|
| `Chatwoot Webhook` | ruta → `laundry-vip` |
| 5 nodos de Chatwoot | `accounts/1/` → `accounts/3/` |
| `Typing Indicator`, audio, imagen, ubicación | phone ID `937260122807094` → `502312282974917` |
| `Memory Arqui` | credencial → Supabase · tabla → `n8n_laundry_chat_histories` |
| `Buscar Referral` | credencial → Supabase · **quitar el `pg_sleep(5)`** (hoy no hay referral y añadiría 5 s a cada mensaje) |
| `Agente Arqui 321` | renombrar + constitución de la lavandería |
| `Cita Agendada?` | → `¿Pedido creado?`, para avisar al operador |
| `Notificar WhatsApp` / `Email` | destinatario → operador |
| `Enviar Ubicación WhatsApp` | coordenadas del local |

**Se borra** (solo lo específico de 321):
- 13 nodos de envío de fotos y videos de propiedades
- 11 tools de Google Sheets + 3 de Google Calendar (no hay videollamadas)
- 3 nodos del cotizador PDF de 321
- 3 de logs a las hojas de 321
- 4 del CRM en Sheets

**Se deja deshabilitado**: los 6 nodos de follow-up. Listos para cuando se
quieran, sin disparar nada hoy.

### Las 6 tools nuevas

Reemplazan a las 11 de Sheets. Todas HTTP contra
`https://laundry-vip.vercel.app/api/webhook`, con el secreto por cabecera:

`cotizar_prendas` · `obtener_proxima_ventana` · `calcular_vehiculo` ·
`find_or_create_client` · `crear_pedido` · `consultar_estado_pedido`

Van como HTTP Request Tool colgando del AI Agent, en la misma posición donde
estaban las de Sheets. El motor de precios aplica las reglas **antes** de
responder, así que el modelo no tiene un precio que malinterpretar.

### Imágenes: la visión extrae hechos, el agente interpreta

El dueño quiere que el agente entienda imágenes desde el primer día: manchas,
cantidad de ropa, comprobantes de transferencia, lo que sea, **según el
contexto de la conversación**.

Problema del 321: `Explicar Imagen` describe la foto **a ciegas**, sin ver la
conversación. Solución acordada, sin cambiar la estructura: ese nodo deja de
escribir prosa y devuelve hechos estructurados —

```
tipo_de_imagen:    prendas | mancha | comprobante | documento | otro
prendas_visibles:  [...]
cantidad_estimada: n
manchas:           [{prenda, zona, aspecto}]
texto_legible:     monto, fecha, banco, referencia
```

— y el agente, que sí tiene la memoria completa, decide qué significan.

**Tres reglas duras, aprobadas:**

1. **Un comprobante NUNCA confirma un pago.** Se acusa recibo y queda
   *pendiente de verificación por el operador*. Con una imagen se engaña a
   cualquier modelo.
2. **No se cotiza contando prendas en una foto.** Puede decir «veo unas 7
   prendas, ¿me confirma la lista?», pero el precio sale de `cotizar_prendas`
   sobre lo que el cliente declare.
3. **Una mancha no se promete.** Puede decir qué tratamiento aplica; nunca
   «sí sale».

### Credenciales de n8n a crear

Tres **nuevas**, nunca reusar las de 321:

- `Chatwoot Laundry VIP API` (httpHeaderAuth, token de la cuenta 3)
- `Meta WhatsApp Laundry VIP` (httpHeaderAuth, `Bearer <token de Meta>`)
- `Postgres Laundry VIP` → Supabase, **session pooler** (puerto 5432, IPv4)

La credencial de OpenAI **sí se reusa** por decisión del dueño (el gasto se
mezcla con el de 321; está anotado como temporal).

El workflow va en una carpeta «Laundry VIP» dentro de su n8n.

### Lo que falta para poder ejecutar

1. **El token de acceso de Meta** — el mismo que pegó en Chatwoot. n8n lo
   necesita por su cuenta para descargar audios e imágenes por la Graph API y
   para el indicador de «escribiendo». **Es el único bloqueo real.**
2. Confirmar que un mensaje de prueba al `+1 555 156 4767` **llega a
   Conversaciones** de la cuenta 3 (hay que terminar de configurar el webhook
   en Meta con el verify token).
3. Resolver el horario: 8:00 u 8:30.

### Prueba de aceptación

- *«5 camisetas»* → **pide el método**, sin dar precio
- *«en agua»* → **$6,75**
- foto de una prenda → la lee y la interpreta en contexto
- nota de voz → la transcribe con `gpt-transcribe`
- pedirle que borre algo → **se niega** y dice que eso se hace en el CRM

### Fuera de alcance de hoy

Modo operador por voz · follow-up automático · referral de Meta Ads (imposible
con número de prueba).

---

## 4. Decisiones que se apartan del documento original

Todas conversadas y aprobadas por el dueño. No las revierta nadie sin
preguntarle.

| Decisión | Por qué |
|---|---|
| **Tres roles** (`superadmin`/`admin`/`operador`) en vez de dos | Lo pidió explícitamente. La sección 11 del documento decía dos |
| **Contraseña en vez de enlace mágico** | El enlace mágico entraba en bucle correo → login → correo |
| **AI Agent de LangChain en vez de «Tool First»** | Es lo que él ya opera. El catálogo es pequeño y cerrado, los precios salen obligatoriamente de la tool y hay un humano contando antes de cobrar |
| **`@supabase/ssr` añadido al stack** | `supabase-js` a secas no maneja la sesión por cookies en el App Router |
| **`lucide-react` añadido** | Iconos de la barra lateral, como el 321 |
| **No se usó el CLI de shadcn** | Habría sobrescrito `globals.css` y borrado los colores de la marca |
| **`OPENAI_API_KEY` fuera del entorno del CRM** | El CRM no llama a OpenAI: lo hace n8n. Se valida con `pnpm check:integraciones` |
| **Session pooler en vez de conexión directa** | La directa solo resuelve a IPv6 y no funciona desde redes sin IPv6 |
| **El catálogo se ve con cualquier rol** | El operador necesita consultar precios para trabajar. Ver no es editar |
| **Desambiguación en el motor de precios** | Si «un edredón» encaja con cuatro filas, pregunta en vez de adivinar |
| **Paquetes cerrados** | 5 cobijas en paquetes de 3 se cobran como 2 paquetes |

---

## 5. Fallos ya encontrados y corregidos

Para que nadie los reintroduzca:

- **El login estaba roto aunque las pruebas pasaban.** Supabase devuelve el
  token en el *fragmento* de la URL, que nunca llega al servidor.
- **El proxy confundía una cookie caducada con una sesión válida** → bucle
  infinito login ↔ panel. Ahora borra las cookies rotas antes de redirigir.
- **Un pedido congelado por discrepancia no se podía cancelar.** La salida de
  emergencia estaba tapiada.
- **«edredón 3 plazas» no se cotizaba**: se filtraban los dígitos, pero en este
  catálogo el número *es* el nombre. Ahora solo se descarta si va al principio.
- **El cajón de móvil no abría**: las utilidades `translate-x` de Tailwind no
  llegaron a generarse. Va por una variable CSS propia.
- **Biome apagó el linter** al migrar la config (`recommended` → `preset: none`).
- **La suite era intermitente**: el identificador de corrida era
  `String(Date.now()).slice(-6)`, que **se repite cada ~16,7 minutos**. Con
  filas sobrantes de una corrida anterior chocaba contra
  `clientes_telefono_key` y fallaban 9 pruebas que no tenían nada malo. Ahora
  el id sale de `tests/util/corrida.ts` con `randomInt`. Si vuelves a ver
  fallos de clave duplicada, **no toques la lógica**: borra las filas de prueba
  (`telefono like '+5939%'`) y vuelve a correr.
- **Dos veces un servidor zombi** en el puerto 3000 sirvió un build viejo y las
  mediciones salieron falsas. Por eso `/api/health` reporta la fase compilada:
  si no coincide, estás midiendo contra otra cosa.

---

## 6. Lo temporal (hay que desmontarlo)

1. **Número de prueba de Meta** — máximo 5 destinatarios registrados a mano, sin
   anuncios Click-to-WhatsApp.
2. **Token de Meta de 24 horas** — para producción hace falta uno permanente de
   System User.
3. **n8n y Chatwoot compartidos con 321** — acordado por tiempo. Se separa
   después.
4. **Credencial de OpenAI compartida con 321** — el gasto se mezcla.
5. **Sin referral de Meta Ads** mientras sea número de prueba.
6. **Un solo proyecto Supabase** para desarrollo y pruebas; las pruebas escriben
   y borran filas ahí.
7. **La contraseña del superadmin la generé yo** (`tQTQRBcfVdzFnwUc`).
8. **`brncjn+admin@gmail.com`** es un alias de Gmail para probar el rol admin.
9. **El token de Vercel quedó escrito en el chat** — hay que rotarlo.

## 7. Lo pendiente

- Instancia propia de n8n y de Chatwoot
- Número real de WhatsApp y token permanente
- Modo operador por voz (las 4 acciones del webhook ya existen y están probadas)
- Follow-up automático (los nodos quedan deshabilitados en el workflow)
- Repositorio en GitHub `laundry-vip` y CI — el remoto ya está configurado en
  local, **falta crear el repo vacío en github.com**
- Segundo proyecto Supabase para producción
- **Los E2E nunca se ejecutaron**: Playwright no pudo descargar Chromium en esa
  máquina (timeout del CDN, tres intentos). La suite está escrita y el CI la
  corre. No digas que están en verde.
- Tabla `meta_referrals` en Supabase, para cuando llegue el número real
- Pantalla para cerrar el mes de los clientes `consolidado_mensual`
