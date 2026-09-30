# Anexo A. Propuesta de reglas para cuando María Sol interviene

El problema: hoy el agente y usted pueden contestarle al mismo cliente sin saberlo, y cada uno puede decir algo distinto. La propuesta es que haya un solo dueño del chat en cada momento, que su palabra mande, y que cada intervención deje una huella que el sistema entienda. Marque en la última columna si está de acuerdo o qué cambiaría.

T: Regla | Qué propongo | Estado hoy | Su decisión
R: 1. Un solo dueño del chat | Cuando usted (o alguien del equipo) escribe a mano en un chat, el agente se pausa en ese chat y deja una nota interna. | Funciona desde el 30/09 | 
R: 2. Cómo devolver el chat | Quitar la etiqueta «humano» o escribir #bot en una nota interna. Además, si usted no vuelve a escribir en 3 horas hábiles y el cliente sigue escribiendo, el agente retoma solo y se lo avisa en una nota. | La etiqueta funciona; #bot y el vencimiento por construir | 
R: 3. Su palabra manda | Lo que usted diga de precios, plazos, cobertura y horarios gana sobre el catálogo y sobre el agente. El agente nunca contradice una cifra dicha por una persona en esa conversación; si choca con el catálogo, le avisa a usted en nota interna en vez de corregirla frente al cliente. | Por construir | 
R: 4. Decisiones reservadas | Siempre las toma usted: descuentos, excepciones de cobertura, reclamos, reembolsos, crédito empresarial, alianzas y cotizaciones grandes. El agente solo toma los datos, le dice al cliente que una persona responde en un plazo concreto, y le avisa. | Parcial (dinero y reclamos ya escalan) | 
R: 5. Venta cerrada por chat | Cuando usted cierre una venta por chat, escribe #venta en una nota interna o crea el pedido en el CRM. Sin marca, el agente la detecta leyendo la conversación, agrega al cliente al CRM y le avisa que falta el pedido. En ambos casos deja de hacer seguimiento. | Detección automática funciona desde hoy; #venta por construir | 
R: 6. Nota de traspaso | Al soltar un chat, una línea en nota interna: qué quedó acordado (precio, fecha, dirección), qué falta y quién sigue. El agente la lee antes de responder. | Por construir | 
R: 7. Qué le avisa a usted por WhatsApp | Solo cuatro casos: reclamo o daño, cliente empresarial grande, venta cerrada sin pedido en el CRM, y cliente molesto. Lo demás va en el resumen de las 8:00 y en el CRM. | Solo el resumen de las 8:00 | 
R: 8. Tiempo de respuesta humana | Si el agente escala y nadie contesta en 30 minutos hábiles, le da al cliente una hora concreta de respuesta y reintenta el aviso a usted y a Daniel. | Por construir | 
R: 9. Seguimiento y su intervención | Si usted atendió a un cliente en las últimas 24 horas, el seguimiento automático no le escribe, salvo que usted ponga #seguir. | Funciona; #seguir por construir | 
R: 10. Cuando usted no está | Usted nombra un suplente (por ejemplo Daniel) con límites: puede responder estado y logística, pero no precios especiales ni reclamos. | Por decidir | 
R: 11. Errores del agente | Cuando alguien note un error, escribe #error y qué pasó en una nota interna. Se revisa cada semana y cada caso se convierte en una regla o en una prueba automática. | Se hace con revisión manual | 
R: 12. Un solo lugar para cada dato | Precios, horarios, plazos, zonas y promociones se cambian solo en el CRM (Servicios y Configuración), nunca en una conversación ni en las instrucciones del agente. | Funciona para casi todo; la lista de barrios espera su respuesta | 

# Anexo B. Lo que el sistema hace hoy (para que sepa qué esperar)

- El agente contesta a los clientes con el catálogo y la configuración del CRM; los permisos y las direcciones obligatorias las hace cumplir el servidor, no el modelo.
- Nunca confirma pagos, corrige montos, cancela ni borra por WhatsApp.
- Si no encuentra un servicio en el catálogo, no dice que no se hace: pregunta o lo confirma con planta.
- Si usted escribe a mano en un chat, el agente se pausa en ese chat.
- Tope de 40 mensajes por teléfono al día y tope de gasto diario de inteligencia artificial, configurables.
- Resumen diario a las 8:00 para las administradoras, dentro de la ventana de 24 horas de WhatsApp.
- Seguimiento a clientes que no contestan (30 min, 1 h, 6 h, 23 h 30 min) con detección de quién ya compró o dijo que no, y aviso interno cuando falta crear el pedido.
- Modo de seguimiento cambiable en Configuración: apagado, borrador o activo.

# Cómo nos devuelve las respuestas

Puede llenarlo a mano sobre el PDF impreso, escribir en el mismo archivo, o contestarlo por audio en el orden de las preguntas (las transcribimos). Con lo que responda se hacen tres cosas: se cargan los datos al CRM (precios, zonas, horarios, plazos), se escriben las reglas del agente con ejemplos, y se convierten los escenarios en pruebas para que no vuelvan a fallar.
