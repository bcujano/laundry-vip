-- 0021 — Avisos del agente al equipo (cuestionario de María Sol, 2026-10).
--
-- Cuando el agente escala un caso (reclamo, dinero, empresa, cobertura dudosa…) el equipo
-- recibe un aviso inmediato por WhatsApp, a cualquier hora; si nadie atiende en 30 minutos
-- hábiles se repite UNA vez. Un aviso por caso, no por mensaje (dedupe por tipo + caso).
-- El texto lo arma el servidor; el agente solo dice qué pasó y el servidor decide el resto.
--
-- Aditiva y con valores por defecto: el código anterior sigue funcionando.

create table avisos_equipo (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  /** Clave del caso: la conversación de Chatwoot, el pedido… Un aviso abierto por (tipo, caso). */
  caso text not null,
  chatwoot_conversation_id integer,
  telefono_cliente text,
  resumen text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviado', 'reintentado', 'atendido')),
  intentos integer not null default 0 check (intentos between 0 and 2),
  creado_en timestamptz not null default now(),
  enviado_en timestamptz,
  atendido_en timestamptz
);

-- Mientras un caso siga abierto no se crea otro aviso igual.
create unique index avisos_equipo_abierto_idx
  on avisos_equipo (tipo, caso)
  where estado <> 'atendido';

create index avisos_equipo_estado_idx on avisos_equipo (estado, creado_en);

alter table avisos_equipo enable row level security;

-- Quién recibe los avisos del agente (la dueña y quien la suple). Se activa por persona.
alter table operador_whitelist
  add column recibe_avisos boolean not null default false;

update operador_whitelist set recibe_avisos = true where activo;

comment on table avisos_equipo is 'Avisos inmediatos del agente al equipo por WhatsApp, con un reintento.';
comment on column operador_whitelist.recibe_avisos is 'Recibe los avisos del agente al equipo (avisos_equipo).';
