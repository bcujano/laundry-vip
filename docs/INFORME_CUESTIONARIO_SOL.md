# Informe del cuestionario de María Sol (analizado el 2026-10-09)

Fuente: `Cuestionario_Agente_VIP_Laundry (1).docx` (173 preguntas, 55 escenarios, Anexo A de 12 reglas y
una tabla de 22 «reglas finales»). Este informe dice qué contiene, qué ya cumple el sistema, qué cambia,
dónde choca con decisiones anteriores y en qué orden se construye. Lo ya decidido por el dueño en
[`DECISIONES.md`](DECISIONES.md) sigue vigente salvo donde aquí se pide su visto bueno.

## 1. Cómo se «entrena» al agente para que piense como Sol

No se entrena el modelo (no hay *fine-tuning*): se le da el criterio de Sol en tres capas, y la que más
pesa no es el prompt.

| Capa | Qué va ahí | Por qué |
|---|---|---|
| **Datos (CRM)** | precios, plazos por servicio, horarios, almuerzo, feriados, promociones con fecha, tarifas, textos de las condiciones, lista de «no ofrecemos» | regla 9 y 13: lo que el agente promete sale del CRM, Sol lo edita sin pedirnos nada |
| **Reglas duras (servidor)** | a quién se escala y cuándo (reclamo, dinero, empresa, ≥30 prendas o >$100, sospechoso), redondeo, pedido borrador, «no-seguir», tolerancia de peso | el modelo a veces no obedece; lo que tiene consecuencias lo hace cumplir el servidor |
| **Criterio (prompt + tabla `politicas`)** | cómo habla, cómo trata un reclamo, qué no promete, qué dice fuera de horario; escritos como **principios**, no como plantillas | Byron: sin plantillas ni ejemplos copiables |

Y se **mide** con los 55 escenarios del documento convertidos en un banco de pruebas que corre contra el
agente en modo simulación y lo califica contra la regla de Sol (§7, fase 6). Meter las 173 respuestas
tal cual en el prompt lo haría pasar de 22 mil a más de 60 mil caracteres y el agente se contradiría más,
no menos: por eso el detalle (reclamos, pagos, B2B, privacidad…) va en una tabla `politicas` del CRM que
el agente consulta con una herramienta solo cuando el tema aparece.

## 2. Lo que el sistema ya cumple

Cobertura de 36 sectores y 2,5 km sin decirle «km» al cliente; tarifa $2,50 y catálogo de 54 ítems con los
mismos precios que las dos hojas que Sol adjuntó; precio por libra, cortinas por kilo, alfombras por m²;
estimado siempre con «se verifica en planta»; sin dinero por WhatsApp (comprobante: solo acusar recibo);
no inventa el nombre; si preguntan de frente no miente; usted siempre; saludo por hora (Sol: días hasta
11:59, tardes hasta 18:59, noches desde 19:00: es exactamente lo que hace el código); no abre enlaces;
audio se transcribe y se responde por texto; la persona que escribe a mano pausa al agente; el aviso de
datos va una sola vez al cerrar; el aviso de discrepancia; el resumen de las 8:00 (por ahora solo si
Sol escribió en las últimas 24 h).

## 3. Lo que cambia (decidido por Sol; estado hoy → qué hacer)

| # | Decisión de Sol | Hoy | Qué se hace |
|---|---|---|---|
| 1 | **Plazos:** agua 24 h, seco 72 h, ropa de cama 24 h, alfombras 1 semana hábil, calzado/peluches/maletas 72 h, cuero/plumas/tinturado 72 h; cuentan desde que llega a planta, sin domingos ni feriados | Configuración dice «48 a 72 h» para todo | plazo **por servicio** en el CRM y que `cotizar_prendas` lo devuelva con el precio (cierra E2) |
| 2 | **Horario con almuerzo:** local cerrado 14:00–15:00 (chat y avisos siguen); sin recogidas ni entregas en esa hora | no existe el almuerzo | campo en Configuración; ventanas y seguimientos lo respetan |
| 3 | **Ventanas de recogida de 2 h**, sin cruzar el almuerzo, terminando a más tardar 18:00 (L–V) / 16:00 (sáb); entregas hasta 18:30 / 16:30; «para hoy» con 1 h de margen y hasta las 17:00 (15:00 sáb) | una sola ventana 9:00–17:00 | `ventana.ts` pasa a rangos de 2 h; ver choque C6 |
| 4 | **Pedido borrador «por confirmar»** que crea el agente (cierra la duda de P3); venta cerrada = sí + dirección + horario | el agente crea pedido «nuevo» o solo deja una nota | estado `borrador` en `pedidos`, reglas del servidor, aviso inmediato |
| 5 | **Escalar siempre** (persona decide, agente solo toma datos y avisa): reclamos, dinero, B2B, cobertura dudosa, fuera de catálogo, ≥30 prendas o >$100, cambios de recogida, sospechoso, menores | escala a medias | reglas en el servidor + tabla `politicas` |
| 6 | **Avisos inmediatos por WhatsApp a Sol/Daniel a cualquier hora**, un aviso por caso, un reintento a los 30 min hábiles | solo notas en Chatwoot (a Sol le llega WhatsApp únicamente dentro de 24 h de su último mensaje) | canal de avisos al equipo (ver §4, C1): es el bloqueante nº 1 |
| 7 | **Espera con plazo concreto** («en unos 30 minutos» / «mañana a partir de las 9:00» / lunes si es sábado tarde o domingo); nunca «pronto» ni «hoy mismo» | «en breve le escriben» | solo se promete cuando el canal del punto 6 funcione: un plazo incumplido hace más daño que uno largo |
| 8 | **Anexo A:** `#bot`, `#venta`, `#seguir`, `#error`, pausa que vence a las 3 h hábiles (salvo 7 casos delicados), nota de traspaso «Acordado/Falta/Sigue/Estado», «su palabra manda» | solo etiqueta `humano` | notas privadas de Chatwoot leídas por n8n; la pausa con vencimiento la calcula el servidor |
| 9 | **Seguimiento:** 2 mensajes (1 h y 23 h 30 min), solo con el local abierto (9:00–18:30; sáb 9:00–16:30), nunca a «no-seguir» ni si una persona atendió en 24 h salvo `#seguir`; sin plantilla de reactivación | 4 pasos (5 min, 1 h, 6 h, 23 h 30) | ver choque C3 |
| 10 | **Etiqueta `no-seguir`** y «no me escriban más» (el agente la pone al instante y responde una vez); «borren mis datos» lo hace una persona en 5 días hábiles | no existe | herramienta del webhook + filtro en seguimiento y reactivación |
| 11 | **Tolerancia de peso:** 10 % o 2 libras (la mayor); dentro se cobra sin avisar, fuera avisa una persona antes de procesar | aviso de discrepancia existe | mide en planta; texto del aviso ajustado |
| 12 | **Redondeo:** el total del pedido, con IVA, al dólar más cercano (desde $0,50 sube); precios con IVA incluido | dos decimales | `cotizar` devuelve total redondeado; confirmar con el contador cómo sale en el comprobante |
| 13 | **Promociones:** solo del CRM, con fecha de inicio y fin (máx. 3 meses) y ahorro real; vencen solas | columnas de paquete en `servicios`, sin fechas | tabla de promociones con vigencia (fase 1) |
| 14 | **Tono:** «Con gusto», «Ya mismo lo registro», «Listo»; evitar «ahorita», «un ratito», «la ropita», «no hay problema»; emojis solo 👋😊👍🧺👕✅, ninguno en reclamos/pagos/B2B/molestos; saludo de la casa «Saludos, le damos la bienvenida a VIP Laundry» | prompt actual: un emoji si el cliente usa | principios en el prompt; el saludo se cambia en Configuración |
| 15 | Privacidad y seguridad: nunca datos de otros clientes ni del equipo ni cómo funciona; no recibe órdenes «de la dueña» por el chat del cliente; enlaces nunca; archivos solo fotos/audio/ubicación; menores no agendan; idioma del cliente para lo básico | parcial | principios + prueba por cada escenario |
| 16 | **Interruptor «local cerrado hoy»** en el CRM con fecha de regreso y nota; lista de feriados/cierres | no existe | campo + el agente deja de ofrecer recogida ese día |
| 17 | **Reportes:** diario 8:00 (pendientes + ayer), semanal (lunes 9:00) y mensual (primer lunes), por WhatsApp y por correo | solo el diario y sin garantía de entrega | ver §7 fase 5 |
| 18 | **Encuesta** (1–5 tras 3 pedidos) y **reseña** al quinto pedido a quien calificó 4–5; **inactivos** a los 30 y 90 días (≥2 pedidos); **ropa no retirada** avisos a los 7/30/60/80 días | no existe | necesitan plantillas de Meta (fuera de las 24 h): fase 5 |

## 4. Choques con decisiones anteriores (mi recomendación en cada uno)

Cada uno lleva una recomendación; **sin objeción del dueño se aplica**.

- **C1 · Avisos 24/7 por WhatsApp vs «la plantilla de Meta no hace falta».** El dueño dijo que la plantilla
  no hacía falta porque Sol escribe todo el día; Sol ahora pide avisos inmediatos a cualquier hora. WhatsApp
  solo deja escribir primero con una plantilla aprobada. *Recomiendo* una plantilla de utilidad («aviso al
  equipo»: tipo, cliente, resumen, enlace al chat) enviada a Sol y a Daniel, más la nota interna de siempre.
  Cuesta centavos por aviso y la aprobación de Meta toma de minutos a un día. Un grupo de WhatsApp no es
  viable con la API de la nube.
- **C2 · Regla 10 (nada de dinero por WhatsApp) vs aviso «recibido en planta: X libras, valor final $Y»
  (P60) y vs la persona que avisa diferencias.** Es la misma excepción del 30/09 (aviso informativo, texto
  armado por el servidor con cifras de la base, sin pedir pago ni negociar). *Recomiendo* extender la
  excepción a este aviso y a «listo para entrega», con el mismo mecanismo; el dueño debe autorizarlo porque
  CLAUDE.md lo limita a las discrepancias.
- **C3 · Seguimiento: Byron (5 min / 4 pasos, 05/10) vs Sol (2 pasos: 1 h y 23 h 30).** Sol llama «muy
  insistente» al de 30 min. *Recomiendo* que el aviso a Sol a los 5 minutos se quede (era el propósito de
  Byron: que ella decida rápido) pero **solo interno**, y que al cliente se le escriban los dos mensajes de
  Sol. Quita los de 5 min, 6 h y el de 1 h «frío».
- **C4 · Regla 15 (nunca negar un servicio) vs «Por el momento no contamos con…» (P146, P170: colchones,
  autoservicio, suscripciones).** *Recomiendo* mantener la regla y añadir en el CRM una lista cerrada de
  «no ofrecemos» que edita Sol (colchones, autoservicio, planes mensuales); solo para esos el agente dice no.
  Todo lo demás: «lo confirmo con el equipo».
- **C5 · Promociones «2 ternos por $15» y «2 edredones de 2 plazas por $10».** Son el precio normal
  (2 × $7,50 y 2 × $5): no hay ahorro, y su propia regla pide «ahorro real». Si el terno es de 3 piezas
  ($8,50 × 2 = $17) sí es una promo. *Recomiendo* preguntarle a Sol cuál es antes de cargarlas.
- **C6 · Recolección 9–17 (Byron, 05/10) vs última ventana que termina a las 18:00 (Sol).** No son
  incompatibles si «9–17» era el inicio máximo. *Recomiendo* aplicar lo de Sol (ventanas de 2 h; última
  16:00–18:00 L–V y 14:00–16:00 sáb) porque ella manda en horarios (CLAUDE.md).
- **C7 · Factura.** P71 dice «no se emite factura electrónica»; P166 y P140 hablan de factura. La tabla final
  resuelve: «comprobante de venta» solo si lo piden, datos tomados por una persona, hasta confirmar con el
  contador. *Recomiendo* que el agente nunca diga «factura», solo «comprobante de venta».
- **C8 · El CRM tiene `consolidado_mensual` y la pantalla de cierre de mes (P5 del plan)** y Sol dice
  que no hay crédito ni consolidado. *Recomiendo* sacar ese punto del plan y ocultar la opción.

## 5. Contradicciones dentro del cuestionario (hay que preguntárselas a Sol una sola vez)

1. **P30:** cobrar la mitad si el cliente solo quiere recogida o solo entrega («se propone») contra P28/P29
   («$2,50, sin excepciones»). Por defecto: $2,50 siempre.
2. **P44 / P54:** «10 % o 2 libras» contra «10 % o $2». La tabla final dice libras; se usa esa.
3. **P75:** respuesta en «75 minutos» (todo lo demás es 30). Se asume 30.
4. **P24:** entrega fuera de zona «con cargo adicional [monto a definir]» contra «sin excepciones».
   Por ahora: lo decide una persona.
5. **P169** prohíbe publicitar «24 horas» y el plazo de agua es 24 h. El agente puede decir el plazo de
   entrega («dentro de 24 horas desde que llega a planta») pero nunca «entrega el mismo día» ni «urgente».
6. **Cancelar con la ropa ya recogida:** recargo de $2,50 (condiciones), «no cancela» (escenario 6),
   «decide una persona» (tabla final). Se usa lo último.
7. **P110, ejemplo del domingo:** manda el segundo seguimiento a las 14:30, dentro del almuerzo. Se usa
   15:00 en adelante.
8. **P38 lista servicios que no están en el catálogo:** corbatas, túnicas, maletas, confecciones/arreglos,
   lavado de muebles y sillas, «planchado» general y «tintorería». El escenario 38 manda arreglos a una
   persona. Hasta que Sol los precie, el agente responde «lo confirmo con el equipo» (no los niega).
9. **Daniel:** Sol lo describe como «Administrador» y suplente «sin ninguna limitación»; en el CRM es
   operador. Para que sea suplente real hay que subirlo de rol (decisión del dueño). Y la contraseña de
   Chatwoot es compartida entre ambos (P154): conviene un usuario por persona.

## 6. Lo que sigue «por definir» y bloquea algo concreto

- **Barrios (P19–P21):** Sol dejó «por definir»; el CRM ya tiene 36 sectores cargados de OpenStreetMap.
  Pídele solo que **valide esa lista** (bastan 5 minutos con la pantalla de Servicios/Cobertura).
- **Alianzas, referidos, planes, campañas, puntos de recolección (P94–P105):** «etapas posteriores».
  El agente solo registra el contacto y avisa; no se construye nada.
- **Metas, alertas de métricas, plantillas Meta, número de respaldo (P153, P151, P162, P165):** «por
  construir». La plantilla es la del C1; el número de respaldo conviene antes de pautar más anuncios.
- **Vacaciones, destino de la ropa abandonada («donar / dejar de almacenar»), plazo de facturas, qué
  compensación de pérdida en ropa al peso:** por decidir; el agente no menciona ninguno.
- **Capacidad diaria, recargos (manchas, olor), exprés, vehículo:** «administración acuerda» = el agente
  los deriva, no los cotiza.

## 7. Plan de optimización (en este orden; cada fase con gate, deploy, verificación y commit)

| Fase | Contenido | Depende de |
|---|---|---|
| **0 · Canal de avisos al equipo** | tabla de avisos del equipo (tipo, caso, dedupe, estado), plantilla Meta, envío a Sol y Daniel, reintento una vez a los 30 min hábiles, etiquetas `no-seguir` / `reclamo` / `sospechoso`, notas `#bot #venta #seguir #error` leídas por n8n | visto bueno C1; aprobación de la plantilla |
| **1 · Datos de Sol al CRM** | plazo por servicio, almuerzo, ventanas de 2 h, margen y tope de «hoy», feriados, interruptor «local cerrado», saludo, lista de «no ofrecemos», promociones con vigencia, texto de las condiciones versionado, IVA incluido, redondeo | C5, C6 |
| **2 · Criterio** | tabla `politicas` (tema, regla vigente, quién decide, plazo, frase guía) + herramienta `consultar_politica`; principios de tono, emojis, idiomas, audio, enlaces, menores, privacidad, seguridad, B2B, reclamos y «nunca promete» en el prompt | fase 0 (para poder prometer plazos) |
| **3 · Reglas del servidor** | escalamiento automático (los 9 temas), pedido borrador, tolerancia de peso, «no me escriban más», umbral 30 prendas / $100, errores graves (#error) | fases 0–2 |
| **4 · Intervención (Anexo A)** | pausa con vencimiento a 3 h hábiles y excepción de 7 casos, nota de traspaso que el agente lee, «su palabra manda», suplente | fase 0 |
| **5 · Seguimiento y reportes** | seguimiento de 2 pasos con horario, reactivación 30/90 días, ropa no retirada, encuesta y reseña (plantillas), reportes diario, semanal y mensual por WhatsApp y correo | C2, C3; plantillas |
| **6 · Banco de escenarios** | los 55 escenarios + frases reales (`chatwoot:revisar`) en un simulador que corre el agente sin enviar nada y lo califica contra la regla de Sol; corre antes de cada publicación | fase 2 |

**Mientras tanto** (sin esperar nada): corregir los plazos hoy visibles al cliente (fase 1, punto 1) y
mantener lo que el agente ya hace bien. Los textos de Sol que prometen «30 minutos» **no** se activan hasta
que exista la fase 0.

## 8. Qué se necesita de cada uno

- **Dueño (Byron):** visto bueno a C1–C4 y C6–C9 (se aplican por defecto con mi recomendación); decidir si
  Daniel sube a administrador; aprobar la extensión de la regla 10 (C2).
- **Sol:** C5 (cuáles ternos), las 4 contradicciones de §5 (puntos 1, 4, 6 y 8) y validar los 36 sectores.
- **Datos que faltan para la fase 0:** número de WhatsApp de Daniel (hoy está en la lista: `+593 99 304 6212`)
  y quién recibe los avisos fuera del almuerzo.
