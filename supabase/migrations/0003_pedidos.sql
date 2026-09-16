-- 0003 — Pedidos, sus ítems, su historial y las correcciones de cotización.

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  -- restrict a propósito: nunca se borra un cliente con historial.
  cliente_id uuid not null references clientes(id) on delete restrict,
  canal text not null check (canal in ('whatsapp_agente', 'presencial')),
  estado text not null default 'nuevo' check (estado in (
    'nuevo',
    'esperando_pago_para_recoleccion',
    'recolectado',
    'en_proceso',
    'esperando_pago_para_entrega',
    'listo_para_entrega',
    'entregado',
    'cancelado',
    'recoleccion_fallida',
    'discrepancia_detectada'
  )),
  tipo_entrega text check (tipo_entrega in ('combo', 'a_la_carta')),
  metodo_transporte_recoleccion text not null default 'n_a'
    check (metodo_transporte_recoleccion in ('app', 'propio_cliente', 'n_a')),
  metodo_transporte_entrega text not null default 'n_a'
    check (metodo_transporte_entrega in ('app', 'propio_cliente', 'n_a')),
  pago_recoleccion text not null default 'n_a'
    check (pago_recoleccion in ('pagado', 'pendiente', 'n_a')),
  pago_entrega text not null default 'n_a'
    check (pago_entrega in ('pagado', 'pendiente', 'n_a')),
  pago_lavado text not null default 'estimado' check (pago_lavado in (
    'estimado', 'confirmado', 'pagado', 'pendiente', 'acumulado_mensual'
  )),
  monto_recoleccion numeric(10, 2),
  monto_entrega numeric(10, 2),
  monto_combo numeric(10, 2),
  monto_estimado_lavado numeric(10, 2),
  monto_confirmado_lavado numeric(10, 2),
  numero_fundas integer check (numero_fundas > 0),
  vehiculo_sugerido text check (vehiculo_sugerido in ('moto', 'auto')),
  direccion_recoleccion text,
  ventana_recoleccion_inicio timestamptz,
  ventana_recoleccion_fin timestamptz,
  foto_pre_recoleccion_url text,
  discrepancia_detectada boolean not null default false,
  discrepancia_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un pedido presencial no tiene logística: el cliente vino al local.
  constraint pedidos_presencial_sin_logistica check (
    canal <> 'presencial' or (
      direccion_recoleccion is null
      and vehiculo_sugerido is null
      and numero_fundas is null
    )
  ),
  constraint pedidos_ventana_coherente check (
    ventana_recoleccion_fin is null
    or ventana_recoleccion_inicio is null
    or ventana_recoleccion_fin > ventana_recoleccion_inicio
  )
);

create trigger pedidos_updated_at before update on pedidos
  for each row execute function set_updated_at();

create index pedidos_estado_idx on pedidos (estado);
create index pedidos_ventana_idx on pedidos (ventana_recoleccion_inicio);
create index pedidos_cliente_idx on pedidos (cliente_id);

create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  origen text not null check (origen in ('declarado', 'verificado')),
  -- Un ítem verificado siempre apunta al declarado que corrige.
  item_declarado_id uuid references pedido_items(id) on delete cascade,
  servicio_id uuid references servicios(id) on delete set null,
  descripcion text not null,
  cantidad numeric(10, 2) not null check (cantidad > 0),
  metodo_elegido text check (metodo_elegido in ('unico', 'agua', 'seco', 'planchado')),
  precio_unitario numeric(10, 2),
  subtotal numeric(10, 2),
  no_reconocido boolean not null default false,
  created_at timestamptz not null default now(),
  constraint pedido_items_verificado_referencia check (
    origen <> 'verificado' or item_declarado_id is not null
  )
);

create index pedido_items_pedido_idx on pedido_items (pedido_id);

create table pedido_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  actor text not null check (actor in ('agente', 'operador', 'sistema')),
  staff_id uuid references staff(id) on delete set null,
  motivo text,
  created_at timestamptz not null default now()
);

create index pedido_eventos_pedido_idx on pedido_eventos (pedido_id, created_at);

create table correcciones_cotizacion (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  monto_anterior numeric(10, 2) not null,
  monto_corregido numeric(10, 2) not null check (monto_corregido >= 0),
  motivo text not null,
  corregido_por_staff_id uuid references staff(id) on delete set null,
  notificado_cliente boolean not null default false,
  created_at timestamptz not null default now()
);

create index correcciones_pedido_idx on correcciones_cotizacion (pedido_id);
