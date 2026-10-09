-- 0020 — Plazo de entrega por servicio (decisión de María Sol, cuestionario 2026-10).
--
-- Antes había un solo lapso para todo («48 a 72 horas», en Configuración). Sol lo
-- fijó por servicio y se cuenta desde que la ropa llega a planta, sin domingos ni
-- feriados: agua 24 h, seco 72 h, ropa de cama 24 h, alfombras 1 semana hábil (168 h),
-- calzado, peluches y mochilas 72 h, tinturado, cuero y edredón de plumas 72 h.
-- El CRM sigue siendo la fuente de verdad: Sol cambia el plazo en Servicios.

alter table servicios
  add column plazo_horas integer not null default 72 check (plazo_horas > 0);

-- Valores de Sol según el método de lavado...
update servicios set plazo_horas = 24 where metodo in ('agua', 'planchado');
update servicios set plazo_horas = 72 where metodo in ('seco', 'unico');

-- ...y sus excepciones por categoría o prenda.
update servicios set plazo_horas = 168 where categoria = 'Alfombras';
update servicios set plazo_horas = 72 where categoria in ('Calzado', 'Peluches', 'Mochilas');
update servicios set plazo_horas = 24 where nombre_item = 'Duvet';

comment on column servicios.plazo_horas is
  'Horas de entrega desde que la ropa llega a planta (sin domingos ni feriados). 168 = 1 semana hábil.';
