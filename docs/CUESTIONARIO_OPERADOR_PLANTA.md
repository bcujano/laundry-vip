# Cuestionario Operativo — Lavandería (La Kennedy, Quito)

> Propósito: entender la operación real para que el agente IA, el CRM y los workflows de n8n se
> ajusten al negocio tal como funciona hoy — no a como creemos que funciona. Llenar con el
> operador de planta y con el dueño. Donde no aplique, dejar en blanco y anotar "N/A".
>
> Instrucciones: responde en el espacio bajo cada pregunta. No hay respuesta incorrecta — entre
> más honesto y específico, mejor queda automatizado.

---

## 0. Datos generales del negocio

1. Nombre comercial del negocio (el que verá el cliente en WhatsApp):
2. Dirección exacta de la planta de lavado:
3. Radio de cobertura para recolección — ¿confirmamos 5km a la redonda, o es distinto según la zona?
4. ¿Cuántas personas trabajan hoy en el negocio, y qué hace cada una? (dueño, operador de planta, algún ayudante, etc.)

---

## 1. Catálogo de servicios y precios

5. Lista todos los servicios que ofrecen hoy (lavado y secado, lavado en seco, planchado, ropa de cama, mantelería, uniformes, etc.) con su precio actual:

   | Servicio | Precio | Unidad (por kg / por prenda / por funda) | Tiempo de entrega |
   |---|---|---|---|
   |  |  |  |  |
   |  |  |  |  |

6. ¿Hay servicios distintos o precios distintos para clientes B2B (clínicas, hoteles, restaurantes) vs clientes normales?
7. ¿Manejan algún mínimo de pedido (en fundas, kg o valor) para aceptar recolección a domicilio?
8. ¿Qué NO lavan / qué rechazan (prendas delicadas, ciertos materiales, etc.)?

---

## 2. Capacidad y tiempos de proceso

9. ¿Cuántas fundas o kg pueden procesar por día actualmente?
10. ¿Cuál es el cuello de botella hoy — lavado, secado, planchado, entrega, o ninguno?
11. Si un cliente B2B nuevo pidiera un volumen grande (ej. un hotel con 20 fundas semanales), ¿podrían con eso hoy, o necesitarían ajustar algo (personal, equipos, horario)?
12. Tiempo real de entrega típico, desde que se recoge hasta que está listo para devolver: ______

---

## 3. Clientes actuales

13. ¿Ya tienen algún cliente B2B fijo hoy (clínica, restaurante, hotel, otro)? ¿Cuáles y con qué frecuencia?
14. ¿Cómo funciona hoy el registro de un cliente que llega presencialmente al local? ¿Anotan algo, o es informal?
15. ¿Tienen algún listado (cuaderno, Excel, WhatsApp) de clientes actuales que debamos migrar al CRM?

---

## 4. Recolección y entrega

16. Hoy, cuando alguien pide recolección a domicilio, ¿cómo lo resuelven? (¿van ustedes mismos en moto propia, piden un Uber/inDrive, usan una mensajería?)
17. ¿Tienen moto propia del negocio, o dependen 100% de un servicio externo (Uber, inDrive, mensajería)?
18. ¿Quién decide y ejecuta la recolección — el dueño, el operador, cualquiera disponible?
19. ¿Qué tan seguido pasa que el pedido no cabe en una funda y necesitan auto en vez de moto? (para calibrar si el umbral de "1 funda = moto" tiene sentido en la práctica)
20. Al momento de la entrega de vuelta, ¿el mismo mensajero/moto regresa, o es un viaje aparte?

---

## 5. Cobro y facturación

21. ¿Cómo cobran hoy — efectivo al entregar, transferencia, ambos?
22. Para los clientes B2B fijos (si los hay), ¿cobran por pedido o hacen una cuenta consolidada mensual?
23. ¿Emiten factura hoy? ¿Con qué sistema (manual, algún software contable)?
24. ¿Qué pasa si un cliente no paga a tiempo — hay algún proceso, o se maneja caso por caso?

---

## 6. Comunicación y atención actual

25. ¿Ya usan WhatsApp Business hoy para atender clientes? ¿Con qué número?
26. ¿Quién responde hoy los mensajes de WhatsApp — el dueño, el operador, los dos?
27. ¿Qué preguntas repiten más los clientes por WhatsApp? (horario, ubicación, precios, tiempo de entrega, algo más)
28. ¿Tienen alguna promoción o forma de pauta activa hoy en Meta (Facebook/Instagram Ads), o sería la primera vez?

---

## 7. Reclamos e incidentes

29. ¿Qué hacen hoy si se pierde o daña una prenda? ¿Hay algún proceso de reclamo?
30. ¿Ha pasado que un cliente reclama que le entregaron ropa equivocada? ¿Cómo lo resolvieron?

---

## 8. Horarios y disponibilidad

31. Horario de atención del local (días y horas):
32. Horario en que SÍ pueden hacer recolecciones a domicilio (puede ser distinto al horario del local):
33. ¿Trabajan fines de semana / feriados?

---

## 9. Identidad de marca y tono

34. ¿Cómo quieren que se llame o se presente el agente de WhatsApp? (ej. "Soy el asistente de [nombre]")
35. ¿Tono formal (usted) o cercano (tú) — pensando que hablará tanto con clínicas/hoteles como con vecinos del barrio?
36. ¿Tienen logo, colores de marca o algo visual ya definido para usar en el CRM y en materiales?

---

## 10. Infraestructura y accesos

37. ¿Ya tienen cuenta de WhatsApp Business API (Meta) para el negocio, o hay que crearla desde cero?
38. ¿Quién administra la cuenta de Meta Business/Ads del negocio?
39. Número(s) de WhatsApp del/los operador(es) de planta que van a mandar las notas de voz de registro presencial (empezamos con 1, dejar espacio para 2-3):
    - Operador 1: ______
    - Operador 2 (futuro): ______
    - Operador 3 (futuro): ______

---

## Notas libres del operador

*(Espacio para cualquier detalle de la operación real que no entró en las preguntas de arriba — entre más cuentes de cómo es un día normal en la planta, mejor calibramos el sistema.)*



---

*Documento vivo — se puede volver a llenar o ajustar a medida que el negocio cambie. Una vez lleno, se usa para calibrar: el catálogo de servicios en el CRM, el umbral moto/auto, el prompt del agente, y el horario del workflow de n8n.*
