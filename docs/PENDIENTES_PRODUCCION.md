# Qué hay que cambiar antes de producción

> El estado completo del proyecto y la tarea en curso están en
> [CONTINUIDAD.md](CONTINUIDAD.md). Este archivo es solo la lista de deudas.

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

## Bloqueado, esperando algo tuyo
- [x] ~~Token de Vercel~~ — desplegado en https://laundry-vip.vercel.app
- [ ] **Supabase → Authentication → URL Configuration**: añadir
      `https://laundry-vip.vercel.app/callback` a *Redirect URLs*. Sin eso, el
      enlace mágico que llega por correo no vuelve al CRM.
- [ ] Rotar el token de Vercel cuando termine la construcción.
- [ ] **Playwright no pudo descargar Chromium** en esta máquina: el CDN dio
      timeout tres veces seguidas. La suite E2E está escrita y el CI la corre,
      pero **no se ha ejecutado localmente todavía**. Reintentar con
      `pnpm exec playwright install chromium`.
- [ ] Repositorio remoto en GitHub, para que corra el CI.

## Infraestructura
- [ ] **Segundo proyecto de Supabase para producción.** Hoy `cvdlslltevwxprdktmfu`
      sirve para desarrollo y pruebas a la vez, y las pruebas escriben y borran
      filas ahí. Antes del primer cliente real hay que separarlos.
- [ ] Contraseña de la base: rotarla al pasar a producción.
- [ ] Clave propia de OpenAI con tope de gasto.
- [ ] Instancias de n8n y Chatwoot en Railway.
- [x] ~~Token de Vercel~~ — hecho. Falta el dominio propio si quieres uno.
- [ ] WhatsApp Business Cloud API: número exclusivo, WABA y token permanente.

## Configuración en el panel de Supabase
- [ ] **Site URL y Redirect URLs**: añadir el dominio de producción
      (`https://.../callback`) además de `http://localhost:3000/callback`.
- [ ] **Plantilla del correo de acceso**: cambiarla para que apunte a
      `{{ .SiteURL }}/callback?token_hash={{ .TokenHash }}&type=magiclink`.
      La plantilla por defecto manda el token en el fragmento de la URL, que
      el servidor no puede leer; hoy funciona igual gracias al puente de
      `/sesion`, pero el camino directo es más limpio y no depende de JS.

## Decisiones que se apartan del documento original
- **Tres roles** (`superadmin`, `admin`, `operador`) en vez de los dos que fija
  la sección 11 del documento de construcción. Decidido el 2026-09-16.
- `@supabase/ssr` añadido al stack: es la forma oficial de manejar la sesión
  por cookies en el App Router; `supabase-js` a secas no lo cubre.
- **No se usó el CLI de shadcn.** Habría sobrescrito `globals.css` con su propio
  tema y borrado los colores que fija el documento (#0F5C4F y compañía). Los
  cuatro primitivos que hacen falta —tabla, campo, botón, etiqueta— están
  escritos a mano en `src/components/ui/primitivos.tsx` con esos tokens. Si más
  adelante hace falta un diálogo con trampa de foco, ahí sí entra Radix.
- **El catálogo se puede ver con cualquier rol**, pero solo el superadmin lo
  edita. El operador necesita consultar precios para trabajar: ver no es editar.


## n8n, Chatwoot y WhatsApp (añadido el 2026-09-16)

### Temporal
- [ ] **Número de prueba de Meta** `+1 555 156 4767`: máximo 5 destinatarios
      registrados a mano y **sin anuncios Click-to-WhatsApp**, así que hoy no
      hay `referral`.
- [ ] **Token de Meta de 24 horas.** Mañana el canal de Chatwoot deja de
      recibir. Cambiarlo por uno permanente de System User.
- [ ] **n8n y Chatwoot compartidos con 321.** Acordado por falta de tiempo.
      Lavandería VIP vive en la **cuenta 3** de Chatwoot, aislada de la 1.
- [ ] **Credencial de OpenAI compartida con 321**: el gasto se mezcla en la
      misma factura.
- [ ] Contraseña del superadmin puesta por Claude: `tQTQRBcfVdzFnwUc`.
- [ ] `brncjn+admin@gmail.com` es un alias de prueba para el rol admin.
- [ ] El token de Vercel quedó escrito en el chat: **rotarlo**.

### Pendiente
- [ ] Instancia propia de n8n y de Chatwoot (separar de 321).
- [ ] Modo operador por voz: las 4 acciones del webhook ya existen y están
      probadas; falta la rama en n8n.
- [ ] Follow-up automático: los 6 nodos quedan **deshabilitados** en el
      workflow, listos para conectar.
- [ ] Tabla `meta_referrals` en Supabase y encender la captura, cuando haya
      número real.
- [ ] Resolver el horario: el dueño dijo que abre a las **8:00**, Google Maps
      dice **8:30**. Está sembrado 08:00 en `configuracion`.
- [ ] Pantalla para cerrar el mes de los clientes `consolidado_mensual`.
