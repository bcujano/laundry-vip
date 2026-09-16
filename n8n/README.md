# El agente de WhatsApp en n8n

Un solo workflow con las dos ramas dentro:
[`workflows/lavanderia-vip-agente.json`](workflows/lavanderia-vip-agente.json).

Los prompts de las dos ramas viven dentro del JSON, en el nodo
**Cargar constituciones**. La copia legible para humanos está en
[`constituciones.md`](constituciones.md); si cambias una, cambia la otra.

## Por dónde entra un mensaje

El webhook de **WhatsApp Cloud API apunta directo a n8n**, no a Chatwoot.

La razón es concreta: el objeto `referral` de Meta Ads —el que dice de qué
anuncio vino el lead— solo existe en el payload crudo de WhatsApp. Chatwoot lo
normaliza y lo pierde. Sin ese objeto no se sabe qué anuncio trae clientes, que
es justo el puente entre lo que se paga en Meta y lo que factura la lavandería.

Chatwoot queda como **bandeja humana**: n8n le espeja cada mensaje para que una
persona pueda tomar la conversación cuando haga falta.

```
WhatsApp Cloud API ──► n8n ──► CRM (/api/webhook) ──► Supabase
                        │
                        └────► Chatwoot (espejo para humanos)
```

## Recorrido del flujo

1. **Verificacion de Meta (GET)** responde el `hub.challenge` al registrar la URL.
2. **Mensaje entrante (POST)** recibe el mensaje.
3. **Es un mensaje valido?** descarta entregas, lecturas y ruido.
4. **Debounce 30s** espera a que la persona termine de escribir.
5. **Extraer mensaje y referral** saca teléfono, texto, audio y el `referral`.
6. **Cargar constituciones** inyecta los dos prompts.
7. **Idempotencia y costo** registra el `message_id`; si ya vino, no se reprocesa.
   Aquí también se reporta el gasto de OpenAI del turno anterior.
8. **Es nota de voz?** → **Transcribir nota de voz** con `gpt-transcribe`.
9. **Es operador?** consulta la lista blanca y **IF operador o cliente** bifurca.
10. Cada rama hace **Tool First**: planificar → ejecutar en el CRM → redactar.
11. **Extraer respuesta** con try/catch que nunca tumba el flujo.
12. **Es un pedido nuevo?** dispara la notificación dual y prepara el despacho.
13. **Espejar en Chatwoot** y **Responder por WhatsApp**.

## Variables de entorno de la instancia

Ningún secreto va escrito en el JSON. Hay una prueba que falla si alguien mete
una llave literal. Configura estas en n8n (Settings → Variables):

| Variable | Para qué |
|---|---|
| `CRM_BASE_URL` | URL del CRM, sin barra final |
| `N8N_WEBHOOK_SECRET` | El mismo valor que tiene el CRM |
| `WHATSAPP_CLOUD_API_TOKEN` | Token permanente del System User de Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | Id del número del agente |
| `WHATSAPP_VERIFY_TOKEN` | El que pones al registrar la URL en Meta |
| `CHATWOOT_BASE_URL` | URL de tu Chatwoot |
| `CHATWOOT_API_TOKEN` | Token de acceso de la API |
| `CHATWOOT_ACCOUNT_ID` | Normalmente `1` |
| `TELEFONO_OPERADOR_PRINCIPAL` | A quién se avisa de cada pedido nuevo |

Además hace falta una credencial de n8n tipo **OpenAI** llamada
`OpenAI Lavanderia VIP`.

## Importar

1. En n8n: **Workflows → Import from File** y elige el JSON.
2. Crea la credencial de OpenAI con ese nombre exacto.
3. Configura las variables de entorno de la tabla.
4. Copia la URL de producción del nodo **Mensaje entrante (POST)**.
5. Pégala en Meta → WhatsApp → Configuration → Webhook, con tu
   `WHATSAPP_VERIFY_TOKEN`, y suscríbete al campo `messages`.
6. Activa el workflow.

## Decisiones que no son negociables

- **Tool First, dos llamadas por turno.** Nunca se colapsan en una. El modelo
  que redacta solo ve datos que devolvió el CRM, así que no tiene de dónde
  inventar un precio ni una fecha.
- **`temperature: 0`, `top_p: 0.1`, `json_object`** en las cuatro llamadas.
- **Timeout de 30 segundos, sin reintento.** Si OpenAI falla, se responde con
  una espera segura y se marca `requiere_escalar_humano`.
- **El despacho es humano-confirmado.** No existe API de courier en Ecuador: el
  flujo arma la solicitud y el operador la ejecuta en Uber o con la mensajería
  local. Es la decisión, no un pendiente.
- **El canal de operador nunca borra.** Eliminar exige entrar al CRM.

## Qué se prueba de esto

`tests/unit/workflow-n8n.test.ts` valida el JSON: que existan los nodos, que
las cuatro llamadas a OpenAI declaren los parámetros correctos, que la
transcripción use `gpt-transcribe`, que las constituciones digan lo que tienen
que decir y que no haya ninguna llave literal.

**Nunca se prueba con llamadas reales a OpenAI, Chatwoot o WhatsApp.** Ningún
gate depende de una cuenta externa viva. Del modelo se prueban los parámetros y
el texto de la constitución, jamás lo que genera.
