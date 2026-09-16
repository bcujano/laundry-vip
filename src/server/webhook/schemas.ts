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
  'confirmar_pago',
  'corregir_cotizacion',
  'generar_reporte',
  'consultar_pedido',
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
  }),

  cotizar_prendas: z.object({ items: z.array(itemCotizable) }),

  calcular_vehiculo: z.object({ numero_fundas: z.number().int() }),

  obtener_proxima_ventana: z.object({ desde: z.iso.datetime().optional() }).optional(),

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
    ventana_recoleccion_inicio: z.iso.datetime().optional(),
    ventana_recoleccion_fin: z.iso.datetime().optional(),
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

  confirmar_pago: z.object({
    telefono_operador: telefono,
    pedido_id: z.uuid(),
    tramo: z.enum(['recoleccion', 'entrega', 'lavado']),
  }),

  corregir_cotizacion: z.object({
    telefono_operador: telefono,
    pedido_id: z.uuid(),
    monto_corregido: z.number(),
    motivo: z.string().min(1),
  }),

  generar_reporte: z.object({
    telefono_operador: telefono,
    desde: z.iso.date().optional(),
    hasta: z.iso.date().optional(),
  }),

  consultar_pedido: z.object({ pedido_id: z.uuid() }),
} satisfies Record<Accion, z.ZodType>

export type ParametrosDe<A extends Accion> = z.infer<(typeof parametrosPorAccion)[A]>
