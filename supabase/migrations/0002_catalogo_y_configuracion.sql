-- 0002 — Catálogo de servicios, configuración del negocio y lista blanca.

create table servicios (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  nombre_item text not null,
  -- 'unico' cuando el ítem no admite elección de método. No se usa null para
  -- que el índice único de abajo funcione sin trucos.
  metodo text not null default 'unico'
    check (metodo in ('unico', 'agua', 'seco', 'planchado')),
  unidad text not null
    check (unidad in ('pieza', 'm2', 'kilo', 'libra', 'paquete', 'par')),
  precio_min numeric(10, 2) not null check (precio_min >= 0),
  precio_max numeric(10, 2) not null check (precio_max >= 0),
  cantidad_por_paquete integer check (cantidad_por_paquete > 0),
  requiere_seleccion_metodo boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint servicios_rango_coherente check (precio_max >= precio_min)
);

create unique index servicios_item_metodo_idx on servicios (nombre_item, metodo);
create index servicios_categoria_idx on servicios (categoria);

create trigger servicios_updated_at before update on servicios
  for each row execute function set_updated_at();

-- Fila única: el check sobre id impide que nazca una segunda configuración.
create table configuracion (
  id integer primary key default 1 check (id = 1),
  nombre_negocio text not null default 'Lavandería VIP',
  saludo_agente text not null default '',
  zona_horaria text not null default 'America/Guayaquil',
  dias_operacion integer[] not null default '{1,2,3,4,5,6}',
  hora_recoleccion_inicio time not null default '09:00',
  hora_recoleccion_fin time not null default '18:00',
  tarifa_combo numeric(10, 2) not null default 5.00,
  limite_mensajes_diarios_por_telefono integer not null default 40,
  limite_costo_diario_openai_usd numeric(10, 2) not null default 5.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger configuracion_updated_at before update on configuracion
  for each row execute function set_updated_at();

create table operador_whitelist (
  id uuid primary key default gen_random_uuid(),
  telefono text not null unique check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
