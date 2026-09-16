-- 0006 — Tres roles en el CRM y el horario real de la lavandería.
-- El documento original fijaba dos roles; el dueño pidió tres. Queda anotado
-- en docs/PENDIENTES_PRODUCCION.md.

alter table staff drop constraint staff_rol_check;
alter table staff add constraint staff_rol_check
  check (rol in ('superadmin', 'admin', 'operador'));

-- El rol 'dueno' del esquema inicial pasa a llamarse 'superadmin'.
update staff set rol = 'superadmin' where rol = 'dueno';

-- Horario de atención del local, distinto de la ventana de recolección:
-- el agente lo necesita para responder "¿a qué hora abren?".
alter table configuracion
  add column hora_apertura time not null default '08:00',
  add column hora_cierre time not null default '17:00',
  -- Margen mínimo entre "ahora" y el inicio de una recolección del mismo día.
  add column margen_minimo_minutos integer not null default 30
    check (margen_minimo_minutos >= 0);

-- Horario real: lunes a sábado, recolección de 08:00 a 12:00.
update configuracion set
  dias_operacion = '{1,2,3,4,5,6}',
  hora_recoleccion_inicio = '08:00',
  hora_recoleccion_fin = '12:00',
  hora_apertura = '08:00',
  hora_cierre = '17:00',
  margen_minimo_minutos = 30
where id = 1;
