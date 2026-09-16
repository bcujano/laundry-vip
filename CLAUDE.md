# Lavandería VIP

CRM interno + backend de un agente de IA en WhatsApp para una lavandería de
barrio en La Kennedy, Quito. Capta clientes B2B (clínicas, restaurantes,
hoteles), cotiza contra el catálogo real, agenda recolección y entrega.

**Antes de tocar nada, lee [`docs/CONTINUIDAD.md`](docs/CONTINUIDAD.md).** Ahí
está el estado exacto, las decisiones ya tomadas y la tarea en curso.

## Cómo trabaja el dueño (Byron)

- Habla español. Todo —código, comentarios, commits, interfaz— va en español
  con tildes y ñ correctas.
- **No le gustan las paradas.** Dijo literalmente: *"estamos parando muchas
  veces innecesariamente"*. Avanza hasta donde puedas y reporta al final.
  Pregunta solo cuando de verdad bloquea.
- Cuando dice *"no ejecutes aún, resolvamos primero"*, respétalo al pie de la
  letra: analiza, propón, espera.
- Quiere que verifiques contra el sistema real, no solo con pruebas.
- Dale recomendaciones, no menús de opciones.

## Reglas del proyecto

1. **Gate por fase**: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`,
   todo en verde. Una advertencia tolerada se vuelve permanente.
2. **Máximo 300 líneas por archivo.** Si crece, se divide por responsabilidad.
3. Sin Docker, sin ORM, sin librería de fechas (`Intl` nativo, Quito es UTC-5
   fijo), sin SDK de OpenAI dentro del CRM (eso lo hace n8n).
4. Las migraciones aplicadas **nunca se editan**: todo cambio es un archivo
   nuevo en `supabase/migrations/`.
5. `src/app/**` nunca importa `lib/supabase/admin.ts` directo: siempre pasa por
   `src/server/**`. `src/server/**` nunca importa React.
6. `scripts/` no usa el alias `@/`: tsx no resuelve los paths de tsconfig.
7. **Ningún secreto en el repo.** Hay una prueba que falla si aparece una llave
   literal en el JSON de n8n.

## Stack

Next.js 16.3.5 · React 19.3.0 · TypeScript 6.0.3 · Tailwind 4.3.3 · Biome 2.5.13
Vitest 5.0.0 · Playwright 1.63.0 · pnpm 12.4.2 · Node 24
Supabase (`supabase-js` crudo, sin ORM) · `postgres` solo en scripts
n8n + Chatwoot + WhatsApp Cloud API · OpenAI `gpt-4.1-mini` y `gpt-transcribe`

> `gpt-transcribe` para audio. **Nunca `whisper-1`**: tiene apagado programado
> y hay una prueba que falla si alguien lo mete en el workflow.

## Comandos

| Comando | Para qué |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | desarrollo y producción |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | el gate |
| `pnpm db:migrate` · `pnpm db:seed` | esquema y catálogo (idempotentes) |
| `pnpm db:staff` · `pnpm db:password <correo>` | cuentas del CRM |
| `pnpm check:integraciones` | las 9 credenciales de n8n |

## Regla imperativa sobre el CRM 321

El dueño tiene otro negocio, **321 Soluciones Inmobiliarias**, que comparte la
instancia de n8n y la de Chatwoot con este proyecto.

**No se toca nada de 321. Nunca. Por ningún motivo.** Ni workflows, ni
credenciales, ni tablas, ni su cuenta de Chatwoot (la 1). Lavandería VIP vive
en la cuenta 3 de Chatwoot y en credenciales propias. Solo se crean cosas
nuevas. Está en `docs/CONTINUIDAD.md` con el detalle de por qué.
