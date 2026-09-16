-- 0004 — Estado operativo del agente: memoria, idempotencia, cuotas y errores.

create table conversaciones (
  id uuid primary key default gen_random_uuid(),
  telefono text not null unique check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  contexto jsonb not null default '{}'::jsonb,
  chatwoot_conversation_id bigint,
  ultima_interaccion timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index conversaciones_ultima_interaccion_idx on conversaciones (ultima_interaccion desc);

-- dedupe_key = message_id de Chatwoot. Es lo que impide procesar dos veces el
-- mismo mensaje cuando n8n reintenta.
create table eventos_procesados (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  tipo text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table mensajes_diarios (
  telefono text not null,
  fecha date not null,
  contador integer not null default 0 check (contador >= 0),
  primary key (telefono, fecha)
);

create table uso_openai_diario (
  fecha date primary key,
  tokens bigint not null default 0 check (tokens >= 0),
  costo_estimado_usd numeric(10, 4) not null default 0 check (costo_estimado_usd >= 0),
  alerta_enviada boolean not null default false
);

create table errores_agente (
  id uuid primary key default gen_random_uuid(),
  telefono text,
  tipo_error text not null,
  mensaje_error text not null,
  payload_bruto jsonb,
  resuelto boolean not null default false,
  created_at timestamptz not null default now()
);

create index errores_agente_sin_resolver_idx on errores_agente (created_at desc)
  where resuelto = false;
