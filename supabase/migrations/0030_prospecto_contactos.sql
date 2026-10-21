-- Bitácora de TODO contacto con un prospecto: el mensaje en frío por plantilla, las llamadas, los
-- mensajes a mano, los seguimientos, las bajas y los cambios de estado. Una fila por hecho; nunca se edita.
-- Lo que el agente hace después de que el prospecto responde (conversación, seguimientos automáticos)
-- ya vive en `conversaciones` y `seguimientos`: la pantalla lo junta al leer, no se duplica aquí.
create table prospecto_contactos (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid not null references prospectos (id) on delete cascade,
  ocurrio_en timestamptz not null default now(),
  tipo text not null check (tipo in ('primer_contacto', 'seguimiento', 'respuesta', 'baja', 'estado', 'nota')),
  canal text check (canal in ('plantilla_whatsapp', 'whatsapp', 'llamada', 'instagram', 'email', 'otro')),
  resultado text not null default '',
  detalle text not null default '',
  -- Quién lo hizo: el nombre del usuario del CRM, o «Automático» si lo hizo el sistema.
  autor text not null default 'Automático',
  automatico boolean not null default false
);

create index prospecto_contactos_prospecto_idx on prospecto_contactos (prospecto_id, ocurrio_en desc);
create index prospecto_contactos_fecha_idx on prospecto_contactos (ocurrio_en desc);

alter table prospecto_contactos enable row level security;

-- Lo que ya se envió por plantilla antes de existir la bitácora queda registrado con su fecha real.
insert into prospecto_contactos (prospecto_id, ocurrio_en, tipo, canal, resultado, detalle, autor, automatico)
select p.id, e.enviada_en, 'primer_contacto', 'plantilla_whatsapp', 'Enviado',
       'Plantilla prospecto_primer_contacto', 'Automático', true
from plantillas_enviadas e
join prospectos p on p.id::text = e.clave
where e.plantilla = 'prospecto_primer_contacto';
