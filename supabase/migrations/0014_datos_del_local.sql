-- 0014 — Dirección, teléfono y enlace del mapa salen de Configuración.
--
-- Hasta hoy vivían escritos en el prompt del agente: si el local se mudaba o
-- cambiaba de teléfono había que tocar n8n. Ahora los edita el dueño en el CRM
-- y el agente los lee con cada mensaje. Los valores de arranque son los que el
-- prompt traía.

alter table configuracion
  add column direccion_local text not null default 'De los Pinos y Pedro Barrios, La Kennedy, Quito',
  add column telefono_local text not null default '(02) 281-0815',
  add column enlace_mapa text not null default 'https://maps.google.com/?q=-0.1382973,-78.4820373';

comment on column configuracion.direccion_local is 'Dónde queda el local, como se lo dice el agente al cliente.';
comment on column configuracion.telefono_local is 'Teléfono fijo del local.';
comment on column configuracion.enlace_mapa is 'Enlace de Google Maps que el agente manda cuando piden la ubicación.';
