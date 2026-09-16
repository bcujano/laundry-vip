# Chatwoot y WhatsApp — checklist de lanzamiento

Todo lo de este documento es **trabajo manual en paneles externos**. No hay
forma de automatizarlo y no se puede probar desde el código: ningún gate de
este repo depende de estas cuentas.

Cuando tengas las nueve variables, compruébalas con:

```bash
pnpm check:integraciones
```

Sale `0` si están todas y tienen buena pinta. Sale `1` y te dice cuál falla.

---

## 1. WhatsApp Business Cloud API — empieza por aquí

Es lo único que puede tardar semanas. Lo demás se hace en una tarde.

- [ ] **Número de teléfono exclusivo.** No puede estar registrado en WhatsApp
      normal ni en la app de WhatsApp Business. Si lo está, hay que darlo de
      baja primero y esperar.
- [ ] **Meta Business Manager verificado.** La verificación de negocio pide
      documentos (RUC, factura de servicios). Este es el paso lento.
- [ ] **App de tipo Business** en developers.facebook.com con el producto
      *WhatsApp* añadido.
- [ ] **WABA** (WhatsApp Business Account) creada y el número asociado.
- [ ] **System User** con rol de administrador sobre la app, y un **token
      permanente** generado para él. El token temporal de 24 horas no sirve
      para producción. → `WHATSAPP_CLOUD_API_TOKEN`
- [ ] Copia el **Phone number ID** de la pantalla de configuración de WhatsApp.
      Es un número largo, **no** el número de teléfono. → `WHATSAPP_PHONE_NUMBER_ID`
- [ ] Inventa una cadena cualquiera para la verificación del webhook y
      guárdala. → `WHATSAPP_VERIFY_TOKEN`
- [ ] **Registra el webhook**: pega la URL de producción del nodo
      *Mensaje entrante (POST)* de n8n, con ese verify token, y **suscríbete al
      campo `messages`**.
- [ ] Verifica que quedó activo: Meta hace un GET y espera el `hub.challenge`.
      El workflow ya responde eso.

> **Una sola URL de callback por app.** Por eso el webhook apunta a n8n y no a
> Chatwoot. Si más adelante alguien lo reapunta a Chatwoot, el agente deja de
> recibir mensajes y se pierde el `referral` de los anuncios.

## 2. Meta Ads — Click-to-WhatsApp

- [ ] Campaña con anuncios **Click-to-WhatsApp** apuntando al número del agente.
- [ ] Radio de 5 km alrededor de la planta, público B2B.
- [ ] Comprueba que los mensajes entrantes traen el objeto `referral`. El
      workflow lo guarda; si no llega, revisa que el anuncio sea realmente
      Click-to-WhatsApp y no un anuncio de tráfico normal.

## 3. Chatwoot en Railway

Chatwoot es la **bandeja humana**, no el canal del agente.

- [ ] Despliega `chatwoot/chatwoot:v4.17.1-ce` en Railway.
- [ ] Añade los servicios que necesita: **PostgreSQL** y **Redis**.
- [ ] Configura el SMTP (si no, no salen los correos de invitación).
- [ ] Asigna un dominio. → `CHATWOOT_BASE_URL` (sin barra final)
- [ ] Entra, crea la cuenta del dueño y el inbox.
- [ ] Perfil → **Access Token**. → `CHATWOOT_API_TOKEN`
- [ ] El id de cuenta sale de la URL (`/app/accounts/1/...`). → `CHATWOOT_ACCOUNT_ID`

**Qué NO hay que hacer:** no conectes el canal de WhatsApp dentro de Chatwoot.
Si lo haces, Chatwoot intentará quedarse el webhook de Meta y el agente dejará
de funcionar. El inbox que usa n8n es de tipo *API*.

## 4. n8n en Railway

- [ ] Despliega `n8nio/n8n:2.38.7` con su volumen persistente.
- [ ] Asigna un dominio.
- [ ] Importa `n8n/workflows/lavanderia-vip-agente.json`.
- [ ] Crea la credencial de OpenAI con el nombre exacto **OpenAI Lavanderia VIP**.
- [ ] Carga las variables de entorno (ver `n8n/README.md`).
- [ ] Activa el workflow y copia la URL de producción del webhook.

## 5. OpenAI

- [ ] Clave propia del proyecto. → `OPENAI_API_KEY`
- [ ] **Pon un tope de gasto mensual en la cuenta de OpenAI.** El tope diario de
      `configuracion` avisa, pero no corta: el corte duro se configura allá.
- [ ] Comprueba en el panel que tu cuenta tiene acceso a `gpt-4.1-mini` y a
      `gpt-transcribe`.

## 6. El CRM

- [ ] `CRM_BASE_URL` apuntando al dominio de producción, **sin barra final**.
- [ ] `N8N_WEBHOOK_SECRET` con **exactamente el mismo valor** en el CRM y en n8n.
      Si no coinciden, cada llamada del agente responde 401 y el agente se queda
      mudo sin decir por qué.

---

## Prueba de humo antes de abrir al público

1. Escribe al número del agente desde un teléfono cualquiera.
2. Debe contestar de usted y ofrecer una ventana de recolección futura.
3. Pide "3 camisetas": debe **preguntar el método**, no dar precio.
4. Di "en agua": debe cotizar **6.75** y marcarlo como estimado.
5. Entra al CRM: el cliente tiene que aparecer en `/clientes`.
6. Manda una nota de voz desde el número del operador: debe registrar un
   cliente presencial, sin dirección ni vehículo.
7. Pídele al agente que borre algo desde WhatsApp: **debe negarse** y decir que
   eso se hace en el CRM.
