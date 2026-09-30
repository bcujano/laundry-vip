-- 0017 — El seguimiento va por pasos.
--
-- Cuando el cliente deja de responder se le escribe a los 30 minutos, a la hora,
-- a las 6 horas y a las 23 h 30 min: así se recorre la ventana de 24 h de
-- WhatsApp. Si en ese lapso no contrata, no se insiste más. `paso` dice cuál de
-- los cuatro fue, y junto con `interaccion_base` evita mandar el mismo dos veces.

alter table seguimientos
  add column paso smallint not null default 1 check (paso between 1 and 4);

create index seguimientos_paso_idx on seguimientos (telefono, interaccion_base, paso);
