-- 0028 — Mensajes de plantilla automáticos (fase 5 del cuestionario de Sol).
--
-- Reactivación de clientes inactivos (30 y 90 días, con al menos 2 pedidos) y aviso de ropa que no
-- se retira (7, 30, 60 y 80 días). Fuera de las 24 h de WhatsApp solo se puede escribir con una
-- plantilla aprobada por Meta (scripts/plantillas-meta.ts). El interruptor arranca APAGADO: el dueño
-- lo enciende cuando Meta haya aprobado las plantillas.

alter table configuracion
  add column plantillas_automaticas boolean not null default false;

comment on column configuracion.plantillas_automaticas is
  'true = n8n envía las plantillas de reactivación y de ropa no retirada. Apagado por defecto.';

create table plantillas_enviadas (
  id uuid primary key default gen_random_uuid(),
  telefono text not null,
  plantilla text not null,
  -- El paso de reactivación o «pedido:<id>:<días>»: lo que impide mandar dos veces lo mismo.
  clave text not null,
  enviada_en timestamptz not null default now(),
  unique (plantilla, clave)
);

create index plantillas_enviadas_telefono_idx on plantillas_enviadas (telefono, enviada_en desc);
alter table plantillas_enviadas enable row level security;
