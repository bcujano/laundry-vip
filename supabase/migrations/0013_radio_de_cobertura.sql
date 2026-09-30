-- 0013 — La cobertura es un radio, no una zona de la ciudad.
--
-- La 0012 la guardó como texto («norte de Quito») a partir de lo que la dueña
-- respondía en WhatsApp. El dueño precisó el mismo día: se opera a 2,5 km a la
-- redonda de la planta. Un radio se puede verificar; «el norte» no.

alter table configuracion
  add column radio_cobertura_km numeric(4, 1) not null default 2.5
    check (radio_cobertura_km > 0);

comment on column configuracion.radio_cobertura_km is
  'Hasta dónde llega la recolección, en kilómetros a la redonda del local.';

alter table configuracion drop column zona_cobertura;
