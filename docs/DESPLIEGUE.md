# Despliegue

## Lo que hay hoy

| Pieza | Dónde | Estado |
|---|---|---|
| CRM (Next.js) | Vercel | **pendiente**: falta el token de Vercel |
| Base de datos | Supabase `cvdlslltevwxprdktmfu` (São Paulo) | funcionando |
| n8n | Railway | **pendiente** |
| Chatwoot | Railway | **pendiente** |

## 1. Base de datos

El proyecto de Supabase ya existe y está migrado y sembrado.

```bash
pnpm db:migrate   # aplica lo que falte; correrlo dos veces no hace nada
pnpm db:seed      # idempotente, deja el catálogo en 54 filas
pnpm db:staff     # crea las cuentas del CRM y la lista blanca
```

> **Conexión:** se usa el **session pooler** (puerto 5432, IPv4), no la
> *direct connection*. La directa solo resuelve a IPv6 y no funciona desde
> redes sin IPv6, que es la mayoría. No confundir con el *transaction pooler*
> (6543), que no sirve para migraciones.

Antes del primer cliente real hay que **crear un segundo proyecto para
producción**: hoy el mismo proyecto sirve para desarrollar y para correr las
pruebas, y las pruebas escriben y borran filas.

## 2. CRM en Vercel

```bash
pnpm dlx vercel@latest link      # asocia la carpeta al proyecto
pnpm dlx vercel@latest env add   # una por una, para Production
pnpm dlx vercel@latest --prod    # despliega
```

Variables que necesita el CRM en Vercel (y solo estas):

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
TEST_DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
N8N_WEBHOOK_SECRET
OPENAI_COST_ALERT_DAILY_USD
```

**Lo que NO va en Vercel:** `OPENAI_API_KEY`, `CHATWOOT_*` y `WHATSAPP_*`. El
CRM no llama a OpenAI ni a WhatsApp; eso lo hace n8n. Esas credenciales viven
en las variables de la instancia de n8n.

Después del primer despliegue, en el panel de Supabase → Authentication →
URL Configuration, añade el dominio a **Redirect URLs**:
`https://tu-dominio/callback`. Sin eso, el enlace mágico no vuelve al CRM.

## 3. n8n y Chatwoot

Están en [`../n8n/README.md`](../n8n/README.md) y en
[`CHATWOOT_Y_WHATSAPP.md`](CHATWOOT_Y_WHATSAPP.md).

El único punto que conecta las dos mitades: **`N8N_WEBHOOK_SECRET` tiene que
ser idéntico en Vercel y en n8n.** Si no coinciden, cada llamada del agente
responde 401 y el agente se queda mudo sin explicar por qué.

## 4. Comprobación después de desplegar

```bash
curl -s -D - https://tu-dominio/api/health
```

Debe responder `200` con `{"ok":true}` y traer las dos cabeceras:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

Y el webhook sin secreto debe responder `401`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://tu-dominio/api/webhook \
  -H "content-type: application/json" -d '{"accion":"calcular_vehiculo"}'
```

## Integración continua

`.github/workflows/ci.yml` corre en cada push y pull request:

```
install → typecheck → lint → test → build
```

Se detiene en el primer fallo. Las pruebas de integración necesitan estos
secretos en GitHub → Settings → Secrets → Actions:

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_DB_URL`, `TEST_DATABASE_URL`, `N8N_WEBHOOK_SECRET`.

## Comandos del día a día

| Comando | Para qué |
|---|---|
| `pnpm dev` | desarrollo |
| `pnpm typecheck` | tipos |
| `pnpm lint` | Biome |
| `pnpm test` | unitarias + integración |
| `pnpm test:e2e` | Playwright (necesita `playwright install chromium`) |
| `pnpm build` | construir |
| `pnpm check:integraciones` | las 9 credenciales de n8n |
