-- 0027 — Textos de las políticas, tomados de las respuestas de María Sol (cuestionario del 2026-10-09).
--
-- La 0025 sembró los 10 temas sin regla. Aquí se escriben con lo que Sol ya contestó (preguntas
-- 12, 13, 16, 37, 47, 49, 63-67, 71-78, 170 y la tabla de reglas finales) y con lo que el dueño
-- decidió después. Solo se llenan las filas que siguen SIN regla: lo que Sol edite en Configuración
-- no se pisa nunca (regla 9). Lo que ella no definió queda «lo decide una persona».

update politicas set
  regla = 'Solo existen las promociones cargadas en el CRM con fecha de inicio y de fin; hoy no hay ninguna vigente. No hay descuentos por volumen, frecuencia, primera vez, pago anticipado ni recomendación, y el agente no los ofrece ni los negocia. Si el cliente menciona una promoción que no conoces, no la confirmes ni la niegues.',
  quien_decide = 'agente',
  plazo_respuesta = 'en unos 30 minutos',
  frase_guia = 'Lo voy a confirmar con nuestro equipo y le ofrezco una respuesta en aproximadamente 30 minutos.'
where tema = 'promociones' and regla = '';

update politicas set
  regla = 'Domingos no se atiende. Feriados: según su importancia, generalmente sí se atiende, pero no hay recolecta ni entrega. Cierres fijos: 25 de diciembre y 1 de enero. Vacaciones del local: por definir, no menciones ninguna. Si el local cierra de improviso, se avisa con el interruptor «local cerrado hoy» del CRM.',
  quien_decide = 'equipo',
  plazo_respuesta = 'en unos 30 minutos',
  frase_guia = 'Le informamos que VIP Laundry no atenderá ese día. Retomamos en nuestro horario habitual; si desea que recojamos su ropa antes, con gusto le agendamos para el último día disponible.'
where tema = 'vacaciones_feriados' and regla = '';

update politicas set
  regla = 'Se avisa al cliente a los 7, 30, 60 y 80 días. A los 90 días la ropa se considera abandonada. No hay cobro de bodegaje. El destino de la ropa lo decide una persona; el agente no habla de donarla ni de desecharla.',
  quien_decide = 'duena',
  plazo_respuesta = 'en unos 30 minutos',
  frase_guia = 'Eso lo coordina directamente nuestro equipo; le paso con una persona para que lo revise con usted.'
where tema = 'ropa_no_retirada' and regla = '';

update politicas set
  regla = 'Los precios incluyen IVA. No se emite factura electrónica: solo si el cliente pide un comprobante de venta, lo emite una persona con los datos que ella tome. Hasta confirmar con el contador, nunca digas «factura electrónica». No hay crédito ni consolidado mensual.',
  quien_decide = 'equipo',
  plazo_respuesta = 'en unos 30 minutos',
  frase_guia = 'El comprobante de venta lo gestiona nuestro equipo; indíqueme que lo necesita y una persona le toma los datos.'
where tema = 'facturas' and regla = '';

update politicas set
  regla = 'Lo resuelve una persona, nunca el agente. Responde UNA sola vez, con empatía y sin discutir los hechos; di que una persona del equipo se comunicará en unos 30 minutos y pide qué prenda es y qué le pasó (una foto clara ayuda). Nunca admitas culpa, nunca culpes al cliente, nunca prometas ni niegues una compensación, nunca digas «seguro aparece». Los reclamos se aceptan hasta 24 horas después del retiro: en lavado en seco con la etiqueta de la prenda y una foto; en agua con una foto, y cómo y cuándo se dio cuenta. No menciones topes ni montos de compensación.',
  quien_decide = 'duena',
  plazo_respuesta = 'en unos 30 minutos',
  frase_guia = 'Lamentamos lo ocurrido. Ya pasé su caso a una persona de nuestro equipo, que se comunicará con usted en unos 30 minutos.'
where tema = 'perdida_o_dano' and regla = '';

update politicas set
  regla = 'No se ofrece entrega el mismo día ni exprés, y nunca digas «urgente» ni «hoy mismo». Los plazos son los que devuelve cotizar_prendas, contados desde que la ropa llega a planta (sin domingos ni feriados). Cualquier urgencia la acuerda la administración.',
  quien_decide = 'equipo',
  plazo_respuesta = 'en unos 30 minutos',
  frase_guia = 'Los plazos son los que le indiqué; si necesita algo con urgencia lo consulto con nuestro equipo y le respondo.'
where tema = 'express_urgente' and regla = '';

update politicas set
  regla = 'Los plazos y los cupos no cambian en ninguna época del año. Una cotización de 30 prendas o más, o de $100 o más, la confirma una persona. Si se superara la capacidad del día, lo maneja la administración.',
  quien_decide = 'equipo',
  plazo_respuesta = 'en unos 30 minutos',
  frase_guia = 'Para un volumen así, una persona de nuestro equipo le confirma los detalles en unos 30 minutos.'
where tema = 'capacidad_volumen' and regla = '';

update politicas set
  regla = 'Cualquier recargo (manchas difíciles, prendas muy sucias, olores fuertes, pelos de animales, arena o barro, prendas delicadas, urgencia o fuera de horario) lo acuerda la administración; el agente no cotiza ni insinúa ninguno. El precio es el del catálogo y planta verifica la prenda. Nunca prometas que una mancha sale: depende de la tela y de la antigüedad de la mancha.',
  quien_decide = 'equipo',
  plazo_respuesta = 'en unos 30 minutos',
  frase_guia = 'El precio es el del catálogo; si al revisar la prenda hubiera algo especial, nuestro equipo se lo comunica antes de procesarla.'
where tema = 'recargos' and regla = '';

update politicas set
  regla = 'Nunca niegues un servicio. Hoy no existen colchones, lavandería de autoservicio, planes ni suscripciones mensuales: no los prometas; di que lo confirmas con el equipo y ofrece anotar el interés del cliente. Corbatas, túnicas, maletas, arreglos, muebles y tintorería que no estén en el catálogo: tampoco los niegues, los confirma una persona. Alfombras sí están en el catálogo.',
  quien_decide = 'equipo',
  plazo_respuesta = 'en unos 30 minutos',
  frase_guia = 'Déjeme confirmarlo con nuestro equipo y le respondo en unos 30 minutos; si quiere, anoto su interés.'
where tema = 'servicios_no_ofrecidos' and regla = '';

update politicas set
  regla = 'Se acepta efectivo, transferencia bancaria y DEUNA; se puede pagar al recoger, al entregar o por adelantado, como el cliente prefiera. Los abonos se admiten solo antes de la entrega: la ropa sale con saldo cero. No hay crédito, consolidado mensual, propinas ni canje. El agente nunca da datos bancarios, nunca confirma un pago ni corrige un monto: si el cliente elige transferencia o DEUNA, una persona le envía los datos.',
  quien_decide = 'agente',
  plazo_respuesta = 'en unos 30 minutos',
  frase_guia = 'Puede pagar en efectivo, por transferencia o con DEUNA, al recoger, al entregar o por adelantado, como le resulte más cómodo. Si elige transferencia o DEUNA, una persona le envía los datos.'
where tema = 'formas_de_pago' and regla = '';
