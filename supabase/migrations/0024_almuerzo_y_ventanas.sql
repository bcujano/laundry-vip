-- 0024 — Almuerzo del local y ventanas de recogida de duración fija (cuestionario de Sol, 2026-10-09).
--
-- El local cierra de 14:00 a 15:00: en esa hora no hay recogidas, entregas ni seguimientos (el chat
-- y los avisos siguen). Las ventanas de recogida pasan de «todo el día» a rangos de 2 horas que no
-- cruzan el almuerzo.

alter table configuracion
  add column almuerzo_inicio time not null default '14:00',
  add column almuerzo_fin time not null default '15:00',
  add column ventana_minutos integer not null default 120
    check (ventana_minutos between 30 and 480),
  add constraint configuracion_almuerzo_coherente check (almuerzo_fin > almuerzo_inicio);

comment on column configuracion.almuerzo_inicio is 'Inicio del cierre por almuerzo (hora de Quito).';
comment on column configuracion.almuerzo_fin is 'Fin del cierre por almuerzo (hora de Quito).';
comment on column configuracion.ventana_minutos is
  'Duración de la ventana de recogida que se le ofrece al cliente, en minutos.';
