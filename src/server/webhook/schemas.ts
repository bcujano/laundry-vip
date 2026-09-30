import { z } from 'zod'

/**
 * Contrato de entrada del único endpoint del agente. Cada acción valida lo
 * suyo: el webhook no confía en que n8n mande bien formado nada.
 */

const telefono = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'El teléfono debe venir en formato E.164 (+593...).')

const metodo = z.enum(['unico', 'agua', 'seco', 'planchado'])

export const ACCIONES = [
  'registrar_evento_entrante',
  'sincronizar_memoria_conversacion',
  'verificar_whitelist_operador',
  'find_or_create_client',
  'cotizar_prendas',
  'calcular_vehiculo',
  'obtener_proxima_ventana',
  'crear_pedido',
  'consultar_estado_pedido',
  'registrar_cliente_presencial',
  'actualizar_registro',
  'buscar_pedidos',
  'avanzar_estado',
  'registrar_conteo',
  'consulta_admin',
  'resumen_diario',
  'generar_reporte',
  'consultar_pedido',
  'candidatos_seguimiento',
  'registrar_seguimiento',
  'registrar_conversion',
] as const

export type Accion = (typeof ACCIONES)[number]

/**
 * Sobre común: la acción, sus parámetros y —opcionalmente— el teléfono de
 * quien está hablando. Ese teléfono es lo que permite aplicar el tope diario
 * de mensajes antes de ejecutar nada.
 */
export const sobreEntrante = z.object({
  accion: z.enum(ACCIONES),
  parametros: z.unknown().optional(),
  telefono: telefono.optional(),
})

export const itemCotizable = z.object({
  descripcion: z.string().min(1, 'Cada prenda necesita una descripción.'),
  cantidad: z.number().finite(),
  metodo: metodo.optional(),
})

export const parametrosPorAccion = {
  registrar_evento_entrante: z.object({
    dedupe_key: z.string().min(1),
    tipo: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).optional(),
    // n8n reporta aquí lo que gastó el turno anterior en OpenAI.
    uso_openai: z
      .object({
        tokens: z.number().int().nonnegative(),
        costo_estimado_usd: z.number().nonnegative(),
      })
      .optional(),
  }),

  sincronizar_memoria_conversacion: z.object({
    telefono,
    contexto: z.record(z.string(), z.unknown()).optional(),
    chatwoot_conversation_id: z.number().int().optional(),
  }),

  verificar_whitelist_operador: z.object({ telefono }),

  find_or_create_client: z.object({
    telefono,
    nombre_contacto: z.string().optional(),
    nombre_negocio: z.string().optional(),
    tipo_negocio: z.enum(['clinica', 'restaurante', 'hotel', 'otro', 'particular']).optional(),
    canal_origen: z.enum(['whatsapp_agente', 'presencial', 'referral_ads']).optional(),
    // El nombre del perfil de WhatsApp: provisional hasta que el cliente diga el suyo.
    nombre_whatsapp: z.string().optional(),
  }),

  cotizar_prendas: z.object({ items: z.array(itemCotizable) }),

  calcular_vehiculo: z.object({ numero_fundas: z.number().int() }),

  // «desde» llega como fecha suelta («2026-10-01»), como ISO completo o vacío:
  // el modelo escribe las tres formas. Se valida en el handler.
  obtener_proxima_ventana: z.object({ desde: z.string().optional() }).optional(),

  crear_pedido: z.object({
    cliente_id: z.uuid(),
    canal: z.enum(['whatsapp_agente', 'presencial']),
    tipo_entrega: z.enum(['combo', 'a_la_carta']).optional(),
    items: z.array(itemCotizable),
    metodo_transporte_recoleccion: z.enum(['app', 'propio_cliente', 'n_a']).optional(),
    metodo_transporte_entrega: z.enum(['app', 'propio_cliente', 'n_a']).optional(),
    monto_recoleccion: z.number().nonnegative().optional(),
    monto_entrega: z.number().nonnegative().optional(),
    numero_fundas: z.number().int().positive().optional(),
    direccion_recoleccion: z.string().optional(),
    sector: z.string().optional(),
    ventana_recoleccion_inicio: z.iso.datetime().optional(),
    ventana_recoleccion_fin: z.iso.datetime().optional(),
  }),

  candidatos_seguimiento: z.object({}).optional(),

  registrar_seguimiento: z.object({
    telefono,
    chatwoot_conversation_id: z.number().int().optional(),
    modo: z.enum(['borrador', 'activo']),
    mensaje: z.string().min(1).max(2000),
    interaccion_base: z.iso.datetime({ offset: true }),
    paso: z.number().int().min(1).max(4),
  }),

  registrar_conversion: z.object({
    telefono,
    estado: z.enum(['vendido', 'agendado', 'rechazado']),
    detalle: z.string().max(500).default(''),
    nombre_contacto: z.string().max(120).optional(),
  }),

  consultar_estado_pedido: z.object({ telefono }),

  registrar_cliente_presencial: z.object({
    telefono_operador: telefono,
    telefono_cliente: telefono.optional(),
    nombre_contacto: z.string().optional(),
    nombre_negocio: z.string().optional(),
    items: z.array(itemCotizable),
  }),

  actualizar_registro: z.object({
    telefono_operador: telefono,
    pedido_id: z.uuid().optional(),
    items: z.array(itemCotizable).optional(),
    nombre_contacto: z.string().optional(),
    nombre_negocio: z.string().optional(),
  }),

  // ── Planta (operador y admin) ─────────────────────────────────────────
  buscar_pedidos: z.object({
    telefono_operador: telefono,
    texto: z.string().trim().min(2, 'Escribe al menos 2 letras del cliente o del teléfono.'),
  }),

  avanzar_estado: z.object({
    telefono_operador: telefono,
    pedido_id: z.uuid().optional(),
    // Solo el avance normal de planta. Cancelar y todo lo que toca dinero es del CRM.
    estado: z.enum(['recolectado', 'en_proceso', 'listo_para_entrega', 'entregado']),
  }),

  registrar_conteo: z.object({
    telefono_operador: telefono,
    pedido_id: z.uuid().optional(),
    conteos: z
      .array(z.object({ descripcion: z.string().min(1), cantidad: z.number().int().min(0) }))
      .min(1, 'Falta el conteo de las prendas.'),
  }),

  // ── Solo admin ────────────────────────────────────────────────────────
  consulta_admin: z.object({
    telefono_operador: telefono,
    consulta: z.enum([
      'resumen',
      'atencion',
      'cola_manana',
      'leads_calientes',
      'clientes_top',
      'como_vamos',
    ]),
  }),

  // Lo llama el disparador de las 8:00 de n8n, no una persona.
  resumen_diario: z.object({}).optional(),

  generar_reporte: z.object({
    telefono_operador: telefono,
    desde: z.iso.date().optional(),
    hasta: z.iso.date().optional(),
  }),

  consultar_pedido: z.object({ pedido_id: z.uuid() }),
} satisfies Record<Accion, z.ZodType>

export type ParametrosDe<A extends Accion> = z.infer<(typeof parametrosPorAccion)[A]>
