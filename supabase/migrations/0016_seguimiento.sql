-- 0016 — Agente de seguimiento.
--
-- Retoma a los clientes que pidieron precio y dejaron de contestar, mientras la
-- ventana de 24 h de WhatsApp sigue abierta (fuera de ella Meta exige plantilla).
-- Tres modos, en Configuración:
--   apagado  no hace nada.
--   borrador deja el mensaje como NOTA INTERNA en Chatwoot para que lo revise y
--            lo mande una persona. Es el modo de arranque.
--   activo   lo manda al cliente.

alter table configuracion
  add column seguimiento_modo text not null default 'borrador'
    check (seguimiento_modo in ('apagado', 'borrador', 'activo'));

comment on column configuracion.seguimiento_modo is
  'Agente de seguimiento: apagado, borrador (nota interna) o activo (escribe al cliente).';

create table seguimientos (
  id uuid primary key default gen_random_uuid(),
  telefono text not null,
  chatwoot_conversation_id integer,
  modo text not null check (modo in ('borrador', 'activo')),
  mensaje text not null,
  -- ultima_interaccion de la conversación cuando se decidió el seguimiento.
  interaccion_base timestamptz not null,
  created_at timestamptz not null default now()
);

create index seguimientos_telefono_idx on seguimientos (telefono, created_at desc);

alter table seguimientos enable row level security;
