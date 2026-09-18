# Historia: el plan original del agente (2026-09-16)

Archivado desde CONTINUIDAD.md. Es el plan con el que se clonó el workflow de
321; varias cosas cambiaron después (ver CONTINUIDAD.md). Se conserva por el
razonamiento, no como instrucción vigente.

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
