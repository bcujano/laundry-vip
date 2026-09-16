# Qué hay que cambiar antes de producción

Lista viva. Todo lo de aquí es dato de prueba o atajo consciente que debe
reemplazarse por lo definitivo antes de atender al primer cliente real.

## Cuentas del CRM
| Rol | Correo de prueba | Definitivo |
|---|---|---|
| superadmin | `brncjn@gmail.com` | el mismo, confirmar |
| admin | `brncjn+admin@gmail.com` | **pendiente**: alias de Gmail usado solo para probar el rol |
| operador | `dcwacks.89@gmail.com` | **pendiente**: correo del operador real de planta |

## Datos del negocio
- [ ] **Número de WhatsApp del agente** — aún sin definir.
- [ ] Teléfono del operador en la lista blanca: `+593963987124` (¿es el definitivo?).
- [ ] `nombre_negocio` y `saludo_agente` en `configuracion` — hoy tienen texto por defecto.
- [ ] Dirección de la planta (referencia del radio de 5 km y origen de los despachos).

## Infraestructura
- [ ] **Segundo proyecto de Supabase para producción.** Hoy `cvdlslltevwxprdktmfu`
      sirve para desarrollo y pruebas a la vez, y las pruebas escriben y borran
      filas ahí. Antes del primer cliente real hay que separarlos.
- [ ] Contraseña de la base: rotarla al pasar a producción.
- [ ] Clave propia de OpenAI con tope de gasto.
- [ ] Instancias de n8n y Chatwoot en Railway.
- [ ] Token de Vercel y dominio del CRM.
- [ ] WhatsApp Business Cloud API: número exclusivo, WABA y token permanente.

## Decisiones que se apartan del documento original
- **Tres roles** (`superadmin`, `admin`, `operador`) en vez de los dos que fija
  la sección 11 del documento de construcción. Decidido el 2026-09-16.
- `@supabase/ssr` añadido al stack: es la forma oficial de manejar la sesión
  por cookies en el App Router; `supabase-js` a secas no lo cubre.
