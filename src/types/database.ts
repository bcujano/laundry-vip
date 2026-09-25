/**
 * Tipos de las 14 tablas, escritos a mano.
 * No se generan: el esquema es la fuente de verdad y este archivo es el
 * contrato que el código en TypeScript acepta cumplir.
 */

export type RolStaff = 'superadmin' | 'admin' | 'operador'
export type EstadoStaff = 'activo' | 'inactivo'
export type TipoNegocio = 'clinica' | 'restaurante' | 'hotel' | 'otro' | 'particular'
export type CanalOrigen = 'whatsapp_agente' | 'presencial' | 'referral_ads'
export type ModeloFacturacion = 'por_pedido' | 'consolidado_mensual'
export type OrigenNombre = 'whatsapp' | 'cliente' | 'crm'
export type MetodoServicio = 'unico' | 'agua' | 'seco' | 'planchado'
export type UnidadServicio = 'pieza' | 'm2' | 'kilo' | 'libra' | 'paquete' | 'par'
export type CanalPedido = 'whatsapp_agente' | 'presencial'
/**
 * Cómo se mueve la ropa. Los dos valores son históricos y no se renombran
 * porque hay pedidos reales guardados con ellos; lo que el cliente y el
 * equipo leen sale de `entregaLegible` en `lib/format.ts`:
 *   combo      → la lavandería recoge y entrega, tarifa única de $2,50.
 *   a_la_carta → el cliente trae y retira su ropa en el local (sin tarifa).
 */
export type TipoEntrega = 'combo' | 'a_la_carta'
export type MetodoTransporte = 'app' | 'propio_cliente' | 'n_a'
export type EstadoPagoTramo = 'pagado' | 'pendiente' | 'n_a'
export type EstadoPagoLavado =
  | 'estimado'
  | 'confirmado'
  | 'pagado'
  | 'pendiente'
  | 'acumulado_mensual'
export type VehiculoSugerido = 'moto' | 'auto'
export type OrigenItem = 'declarado' | 'verificado'
export type ActorEvento = 'agente' | 'operador' | 'sistema'

/** Los 10 estados posibles de un pedido, en el orden en que suelen ocurrir. */
export const ESTADOS_PEDIDO = [
  'nuevo',
  'esperando_pago_para_recoleccion',
  'recolectado',
  'en_proceso',
  'esperando_pago_para_entrega',
  'listo_para_entrega',
  'entregado',
  'cancelado',
  'recoleccion_fallida',
  'discrepancia_detectada',
] as const

export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number]

export type Staff = {
  id: string
  auth_user_id: string
  nombre_completo: string
  rol: RolStaff
  estado: EstadoStaff
  created_at: string
  updated_at: string
}

export type Cliente = {
  id: string
  telefono: string
  nombre_contacto: string | null
  /** De dónde salió el nombre: perfil de WhatsApp, el propio cliente o el CRM. */
  nombre_contacto_origen: OrigenNombre
  nombre_negocio: string | null
  tipo_negocio: TipoNegocio
  canal_origen: CanalOrigen
  modelo_facturacion: ModeloFacturacion
  saldo_acumulado: number
  aviso_privacidad_enviado_en: string | null
  created_at: string
  updated_at: string
}

export type Servicio = {
  id: string
  categoria: string
  nombre_item: string
  metodo: MetodoServicio
  unidad: UnidadServicio
  precio_min: number
  precio_max: number
  cantidad_por_paquete: number | null
  /** Precio del paquete completo cuando la lista trae promoción. */
  precio_paquete: number | null
  requiere_seleccion_metodo: boolean
  /** Cómo lo nombra el cliente: el emparejador puntúa contra estos también. */
  sinonimos: string[]
  activo: boolean
  created_at: string
  updated_at: string
}

export type Configuracion = {
  id: 1
  nombre_negocio: string
  saludo_agente: string
  zona_horaria: string
  dias_operacion: number[]
  hora_recoleccion_inicio: string
  hora_recoleccion_fin: string
  hora_apertura: string
  hora_cierre: string
  margen_minimo_minutos: number
  /** Tarifa única de recogida y entrega, aparte del costo del lavado. */
  tarifa_recoleccion_entrega: number
  /** El lapso de entrega que promete el agente: hoy, de 48 a 72 horas. */
  horas_entrega_min: number
  horas_entrega_max: number
  limite_mensajes_diarios_por_telefono: number
  limite_costo_diario_openai_usd: number
  created_at: string
  updated_at: string
}

export type NivelOperador = 'operador' | 'admin'

export type OperadorWhitelist = {
  id: string
  telefono: string
  nombre: string
  activo: boolean
  nivel: NivelOperador
  ultimo_mensaje_en: string | null
  created_at: string
}

export type Pedido = {
  id: string
  cliente_id: string
  canal: CanalPedido
  estado: EstadoPedido
  tipo_entrega: TipoEntrega | null
  metodo_transporte_recoleccion: MetodoTransporte
  metodo_transporte_entrega: MetodoTransporte
  pago_recoleccion: EstadoPagoTramo
  pago_entrega: EstadoPagoTramo
  pago_lavado: EstadoPagoLavado
  monto_recoleccion: number | null
  monto_entrega: number | null
  monto_recoleccion_entrega: number | null
  monto_estimado_lavado: number | null
  monto_confirmado_lavado: number | null
  numero_fundas: number | null
  vehiculo_sugerido: VehiculoSugerido | null
  direccion_recoleccion: string | null
  ventana_recoleccion_inicio: string | null
  ventana_recoleccion_fin: string | null
  foto_pre_recoleccion_url: string | null
  discrepancia_detectada: boolean
  discrepancia_motivo: string | null
  created_at: string
  updated_at: string
}

export type PedidoItem = {
  id: string
  pedido_id: string
  origen: OrigenItem
  item_declarado_id: string | null
  servicio_id: string | null
  descripcion: string
  cantidad: number
  metodo_elegido: MetodoServicio | null
  precio_unitario: number | null
  subtotal: number | null
  no_reconocido: boolean
  created_at: string
}

export type PedidoEvento = {
  id: string
  pedido_id: string
  estado_anterior: string | null
  estado_nuevo: string
  actor: ActorEvento
  staff_id: string | null
  motivo: string | null
  created_at: string
}

export type CorreccionCotizacion = {
  id: string
  pedido_id: string
  monto_anterior: number
  monto_corregido: number
  motivo: string
  corregido_por_staff_id: string | null
  notificado_cliente: boolean
  created_at: string
}

export type Conversacion = {
  id: string
  telefono: string
  contexto: Record<string, unknown>
  chatwoot_conversation_id: number | null
  ultima_interaccion: string
  created_at: string
}

export type EventoProcesado = {
  id: string
  dedupe_key: string
  tipo: string
  payload: Record<string, unknown> | null
  created_at: string
}

export type MensajesDiarios = { telefono: string; fecha: string; contador: number }

export type UsoOpenaiDiario = {
  fecha: string
  tokens: number
  costo_estimado_usd: number
  alerta_enviada: boolean
}

export type ErrorAgente = {
  id: string
  telefono: string | null
  tipo_error: string
  mensaje_error: string
  payload_bruto: Record<string, unknown> | null
  resuelto: boolean
  created_at: string
}

/** Las 14 tablas del esquema, en un solo lugar. */
export const TABLAS = [
  'staff',
  'clientes',
  'servicios',
  'configuracion',
  'operador_whitelist',
  'pedidos',
  'pedido_items',
  'pedido_eventos',
  'correcciones_cotizacion',
  'conversaciones',
  'eventos_procesados',
  'mensajes_diarios',
  'uso_openai_diario',
  'errores_agente',
] as const

export type NombreTabla = (typeof TABLAS)[number]
