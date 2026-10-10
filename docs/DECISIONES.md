# Decisiones del dueño y fallos ya encontrados

Complemento de [`CONTINUIDAD.md`](CONTINUIDAD.md). Dos listas que existen para
que nadie repita lo que ya se resolvió: §1 lo que el dueño decidió (no se
revierte sin preguntarle) y §2 lo que ya se rompió y por qué.

**Quién manda:** el dueño es **Byron David** (`brncjn@gmail.com`). La
**dueña del negocio en la operación diaria es María Sol Játiva** (administradora
en el CRM y en la lista blanca de WhatsApp): lo que ella ordena sobre el
negocio —horario, cobertura, precios, plazos— manda sobre el prompt, y el agente
debe tratarla como a la dueña.

## 1. Decisiones (no revertir sin preguntarle)

| Decisión | Por qué / cuándo |
|---|---|
| El agente es el workflow de 321 **clonado y recortado**, no uno nuevo | Instrucción textual del dueño; ver `historia-agente.md` |
| Tres roles en el CRM (`superadmin` / `admin` / `operador`) | Lo pidió; la spec decía dos |
| Contraseña en vez de enlace mágico | El enlace entraba en bucle |
| AI Agent de LangChain, no «Tool First» | Es lo que el dueño ya opera |
| Registro en el CRM en cada turno | Como el CRM de 321: todo lead queda, compre o no |
| Dos niveles de WhatsApp autorizado y **nada de dinero por WhatsApp** | 2026-09-17, tras una orden inventada con ID falso. **Excepción del 2026-09-30:** el aviso informativo automático de una discrepancia (texto del servidor, sin pedir pago, solo dentro de las 24 h) |
| Resumen diario de las 8:00 para admins, **texto libre** dentro de las 24 h de Meta | El CRM anota la hora del último mensaje de cada autorizado (migración 0008); la plantilla es solo respaldo |
| Nombre de WhatsApp como nombre **provisional** del lead; el que diga el cliente lo reemplaza; lo que escribe el equipo en el CRM no se pisa | El dueño no quiere leads «Sin nombre». `clientes.nombre_contacto_origen` (migración 0010) |
| Descargas de clientes/pedidos solo para superadmin y admin | Datos personales (LOPDP) |
| **El CRM manda** sobre catálogo y configuración; `pnpm db:seed` no pisa lo que el dueño cambió | 2026-09-21. Las pruebas leen los precios de la base, no los llevan escritos |
| Catálogo: 13 categorías por prenda, 54 ítems, del archivo `catalogo-lavanderia.xlsx` | 2026-09-21. Los `nombre_item` no se tocaron (el agente empareja contra ellos) |
| Cada prenda declara su método (agua / seco) | 2026-09-23. El agente proponía lavar un terno en agua |
| Promoción por cantidad en columnas, nunca en el prompt (cobijas: $5,00 c/u o 3 por $12,00) | 2026-09-21 |
| **No hay «combo» ni «a la carta»:** o se recoge y entrega con la tarifa única, o el cliente trae y retira | 2026-09-23. «No somos un restaurante». En la base siguen los valores `combo`/`a_la_carta` (hay pedidos con ellos); en pantalla sale `entregaLegible` |
| Tarifa única de recogida y entrega **$2,50**, aparte del lavado | 2026-09-23, en Configuración |
| ~~Entrega en 48 a 72 horas~~ → **Plazo por servicio:** agua y ropa de cama 24 h; seco, cuero, plumas, tinturado, calzado, peluches y mochilas 72 h; alfombras 1 semana hábil; cuenta desde que llega a planta, sin domingos ni feriados | 2026-10-09, María Sol (cuestionario P36 y regla final 8); `servicios.plazo_horas` |
| Recolección de lunes a sábado; el local abre **9:00–19:00** y los **sábados hasta las 17:00** | 2026-09-30, dicho por María Sol; migración 0012 |
| **Se recoge a 2,5 km a la redonda del local** | 2026-09-30, dicho por el dueño; migración 0013. Fuera del radio se ofrece traer y retirar |
| **Cuestionario de María Sol, contradicciones resueltas por el dueño (2026-10-09):** (1) tarifa de **$2,50 por pedido** siempre que la lavandería haga al menos un tramo; (2) entrega fuera de zona: la decide una persona, el agente no habla de cargos; (3) tolerancia de peso = la mayor entre 10 % y 2 libras, por prenda se avisa cualquier diferencia de conteo; (4) respuesta humana «en unos 30 minutos»; (5) **cancelar con la ropa ya recogida se cobra por tramo, $2,50 cada uno:** si cancela y pasa a retirarla en planta, solo el tramo de recogida ($2,50); si pide que se la devuelvan, recogida más devolución ($5,00); (6) seguimientos solo con el local abierto y nunca en el almuerzo; (7) servicios fuera del catálogo: «lo confirmo con el equipo», nunca se niegan; (8) no se cargan «2 ternos por $15» ni «2 edredones por $10» (no ahorran); (9) Daniel sube a administrador, con usuario propio; (10) antes de abrir el mismo día: «hoy a partir de las 9:00» | 2026-10-09. Detalle en `INFORME_CUESTIONARIO_SOL.md` |
| **Motor del agente de clientes:** el dueño pidió Gemini gratis como principal y OpenAI de respaldo (esquema de AIUDA Empresas). **Se probó dos veces (2026-10-09) y hoy queda OpenAI `gpt-4.1-mini` principal y Gemini `gemini-3-flash-preview` de respaldo.** (1) `gemini-3.1-flash-lite` no llamó a las herramientas e inventó precios. (2) `gemini-3-flash-preview` + prompt compacto + herramientas de cadenas simples SÍ funciona de extremo a extremo (cotiza, cubre, crea el pedido, no regala descuentos, no miente sobre ser asistente), pero **la capa gratis da solo 20 llamadas al día** (error 429; cada turno con herramientas gasta 2–3, así que se agota con ~4 conversaciones; la llave «Gemini Aiuda» es la de AIUDA y compartiría cuota con Fagal) y **cuando el principal falla y entra el respaldo, n8n no guarda la memoria de ese turno** (el cliente tendría que repetir todo; se vio en la prueba). Se publicó Gemini principal ~1 h 30 min en la madrugada, sin tráfico real, y se revirtió. **Para pasarlo a Gemini:** llave de Google propia de Lavandería con facturación activa (centavos al día) + resolver la memoria en el respaldo; luego `MOTOR_PRINCIPAL='gemini'` en `n8n/generador/modelos.cjs` y probar con `scripts/simular-cliente.ts`. «Gemini Lab» (el agente de pruebas) ya usa ese modelo | 2026-10-09 |
| Peso en **libras**; la ropa de diario va **al peso** ($0,70/lb); las cortinas siguen **por kilo** | 2026-09-23 |
| Siempre **un estimado en dólares**; «se verifica en planta» va después | 2026-09-23. «Decía a todo que en planta se confirma» |
| El negocio se llama **VIP Laundry** y el nombre sale de Configuración | 2026-09-23 |
| **El agente habla como una persona del local:** saludo distinto cada vez, no se anuncia como asistente virtual, lee y espeja el tono, sin frases de call center | 2026-09-24. **Pero si le preguntan de frente si es una persona o un sistema, no miente** (decisión mía, no objetada: mentir ahí es lo que de verdad quema al negocio) |
| El aviso de la ley de datos **no va en el saludo**: va al pedir los datos del cierre | 2026-09-24 |
| **El agente nunca dice que no se ofrece un servicio**; si no encuentra, pregunta o confirma con planta | 2026-09-24 |
| A la dueña (admin) se le habla de usted, por su nombre, con datos del CRM y el siguiente paso útil | 2026-09-23 |
| **Cobertura verificable:** 36 sectores dentro de 2,5 km, tomados de OpenStreetMap | 2026-09-30, pedido por el dueño |
| **El agente saluda con el saludo de la casa** (campo «Saludo» de Configuración) y cambia el resto del mensaje cada vez | 2026-09-30, pedido por el dueño |
| **La recogida y la entrega SIEMPRE van en auto; el agente ya no pregunta cuántas fundas** (se quitó la tool `calcular_vehiculo`). Al peso: siempre un estimado, las libras reales se pesan en planta | 2026-10-01, pedido por el dueño: «cuántas fundas» confundía a los clientes |
| **Seguimiento a quien no contesta:** 5 min, 1 h, 6 h y 23 h 30 min dentro de las 24 h; quien contrata o dice que no, no recibe más | 2026-09-30 |
| **Barrido del primer seguimiento** a todos los leads con ventana abierta, incluso a los que María Sol ya había contestado | 2026-09-30, pedido por el dueño |
| **El primer seguimiento es a los 5 minutos** (no a los 30) y con él se resume el lead a la dueña (nota interna y WhatsApp si cabe texto libre) | 2026-10-05, pedido del dueño: «esa decisión es casi inmediata» |
| **Franja de recolección: lunes a sábado, 9:00–17:00** | 2026-10-05, pedido del dueño |
| **El catálogo en imagen NO lo genera el CRM:** usa la imagen que el dueño pone en Google Drive y llega a WhatsApp como foto nativa (adjunto), sin enlaces. El generador que se hizo se quitó. **Hecho:** `public/catalogo.png` (`vip5.png` de su Drive) → adjunto de Chatwoot | 2026-10-05, pedido del dueño (P1 de `CONTINUIDAD.md`) |
| **El agente es «directo y sin relleno» como principio, no como plantilla:** nada de explicar el radio ni reglas internas, precio y plazo juntos, y los ejemplos del prompt nunca se copian | 2026-10-01 y 2026-10-05, pedido del dueño |
| **No cometer errores:** todo cambio se verifica contra producción (n8n, base, Chatwoot) antes de darlo por hecho; lo que no se pueda ver con tráfico real se anota como pendiente | Byron, repetido varias veces |
| Base de clientes entregada **en cero** a VIP; no cargar datos de ejemplo sin permiso | 2026-09-23 |
| Sin dirección no hay pedido con recogida; el nombre del cliente nunca se inventa | 2026-09-30 |
| OpenAI compartido con 321 | Temporal, acordado |
| Session pooler de Supabase | La conexión directa es solo IPv6 |

## 2. Fallos ya encontrados (no reintroducir)

### Del agente (con clientes reales)

- **Inventó una orden** («✅ Orden registrada», ID y monto falsos) sin llamar a
  la tool. Por eso existe la guardia de `Extraer JSON`.
- **Dijo «no ofrecemos tinturado» y «no lavamos zapatos»** (2026-09-24) teniendo
  ambos en el catálogo. Causa triple: las palabras de pregunta («lavado de…»,
  «hacen…») diluían la coincidencia, faltaban los nombres con que se pide
  cada cosa (sinónimos) y el modelo traducía «no encontré el nombre» como «no
  existe». Arreglado en `normalizar.ts`, `servicios.sinonimos` y el prompt.
- **Prometió recogida «en todo Quito»** a una clienta del sur (2026-09-30) y
  María Sol tuvo que desdecirlo. El agente no tenía ningún dato de cobertura.
- **Dio un horario distinto al del local** (lunes–sábado 9:30–19:00 contra el
  real, con sábado hasta las 17:00).
- **No podía pedir otro día:** la tool `obtener_proxima_ventana` estaba clavada
  en `{}`; decía «para mañana no hay ventana» y confirmó para hoy un pedido que
  el cliente quería para mañana. `es_hoy` además se calculaba contra la fecha
  consultada.
- **Cerró un pedido sin dirección** y con un **nombre inventado** («Juan» para
  un contacto llamado «Jp»).
- **Se contradijo con la dueña:** ella dijo $3,75 por un saco y el agente
  había dicho $7,50 (arrastró «terno» del mensaje anterior en vez de consultar).
- **Cotizó por prenda la ropa de diario:** 7 camisetas a $17,50 cuando por
  libra eran ~$7. «Calentadores» y «busos» no existían ni como sinónimo, y
  «calentador deportivo» cotizaba como un par de zapatos.
- **Una sola cobija se cotizaba a $12,00** (solo sabía cobrar el paquete).
- **Ofreció métodos (agua/seco/planchado) para ternos** sin consultar el catálogo.
- **«¿Cuántas fundas?» confunde:** tres clientes respondieron que no entendían.
- **Respondía dos veces seguidas** a una ráfaga, y a veces preguntaba algo que
  el cliente ya había contestado.
- **Quedó mudo con la dueña:** la conversación de María Sol tiene la etiqueta
  `humano` desde que probó con «Mal servicio». **Sigue puesta** (ver
  CONTINUIDAD §3, acción 2).
- **Responde encima de una persona:** cuando María Sol escribe a mano en
  Chatwoot, el agente no se entera y sigue contestando (hueco abierto, B1).

### Del sistema y de las pruebas

- **27 nodos de n8n sin «continuar si falla»** (2026-10-05): el MCP pierde `onError` al crear nodos; un 404 de Chatwoot detuvo el flujo de avisos y `Registrar Entrante` ya no era a prueba de fallos. Ahora `n8n/verificar-errores.cjs` lo comprueba tras cada publicación.
- **El agente se habría callado solo** al cambiar su usuario de Chatwoot (2026-10-01): el filtro de «una persona escribió» todavía ignoraba solo a «Byron ADMIN». Se corrigió antes de que entrara un cliente (`n8n/generador/agente.cjs`).
- **Prometió recogida fuera de zona** (Carcelén Bajo, 2026-10-01) y explicaba «dentro de los 2,5 km a la redonda»: ahora lo verifica por dentro y solo dice sí o no.
- **Gemini flash-lite inventó un precio y un plazo sin llamar a la herramienta** (2026-10-09, simulador, solo con una conversación de prueba: se revirtió en minutos y ningún cliente real lo recibió). La guardia de `Extraer JSON` ahora reemplaza cualquier monto o plazo que no salió de una herramienta de precios en ese turno ni se le había dicho ya al cliente.
- **Seguimiento con saludo equivocado** («buenos días» a las 5 pm; después «Buen mediodía»): la hora la fija el código, no el modelo; la guardia cubre ya «buen día/mediodía» (`n8n/generador/saludo.cjs`).
- **Preguntó «¿cuántos ternos?» a quien dijo «Tengo 3 ternos»** y ofreció recoger a un cliente de Llano Grande (fuera de zona) en el seguimiento (2026-10-03, conv. 26): reglas en el prompt y el redactor lee la conversación.
- **Un archivo con `
` rompe las pruebas del prompt** (buscan `
`): al editar `n8n/prompt-agente-laundry.md` con scripts de Python en Windows, abrir con `newline=''`.
- **Pruebas que vencen con el calendario o chocan con datos reales** (fecha fija «2026-10-05»; conteo de clientes por 5 dígitos que coincidieron con un teléfono real): usar fechas calculadas y frases únicas.

- **La suite borraba datos reales:** `operador.test.ts` usaba el número del
  dueño y le borraba la conversación. **Ninguna prueba usa ni limpia un número
  real ni un valor que el dueño edita en el CRM;** cada corrida crea sus
  propios operadores y admins (`tests/util/corrida.ts`).
- **Pruebas atadas a valores de fábrica** (08:00, combo $5, 54 filas, precios
  escritos) fallaban cuando el dueño cambiaba el CRM. Ahora comparan contra la
  base (`tests/util/catalogo.ts`) y usan «al menos» donde otras pruebas crean
  filas en paralelo.
- **Carrera entre pruebas** por el precio del chal (`servicios.test` lo cambia
  mientras `cotizar.test` lo usa): `cotizar.test` usa bufanda.
- **Los 10 E2E de Playwright nunca habían corrido** hasta el 2026-09-23: su
  preparación de sesión seguía en el login por enlace mágico.
- **`'use server'` solo puede exportar funciones async:** un helper exportado
  desde `actions.ts` rompió el build (vive en `src/lib/sinonimos.ts`).
- **Secreto de 321 en el historial de git** (un JSON de referencia): purgado con
  `git filter-repo` el 2026-09-23; una prueba recorre todo lo rastreado.
- **Transcribir un prompt a mano al MCP se comió una tilde** («propón») y otra
  vez un carácter cirílico. Por eso existe `n8n/verificar-prompts.cjs`.
- **`seed` revertía los precios del dueño** (upsert de la lista del repo).
- Login roto por el token en el fragmento de la URL · bucle login↔panel por
  cookie caducada · pedido congelado sin poder cancelarse · «edredón 3 plazas»
  no se cotizaba · cajón móvil sin `translate-x` · Biome apagado al migrar ·
  corrida repetida cada 16,7 min · servidor zombi en el 3000 (`/api/health`
  reporta la fase compilada).
- **Reemplazos masivos con `node -e` / `String.replace`** dañaron JSX (se
  comieron llaves). Para TSX usa la herramienta Edit.

## 3. Reglas de proceso que salieron de esto

1. **Cada frase real que falle se convierte en una prueba** antes de arreglarla.
2. **Todo lo que el agente promete sale de Configuración,** nunca del prompt.
3. **Lo que tiene consecuencias (dirección, permisos, dinero) lo hace cumplir
   el servidor,** no el prompt: el modelo a veces no obedece.
4. **Verifica contra producción, no solo con pruebas** (el webhook con `curl`
   y el secreto, `pnpm chatwoot:revisar`, ejecuciones de n8n).
5. **Después de subir un prompt, `node n8n/verificar-prompts.cjs`.**
6. **Un hallazgo que no puedes arreglar se escribe en CONTINUIDAD §3–§5,**
   nunca se deja solo en el chat.
