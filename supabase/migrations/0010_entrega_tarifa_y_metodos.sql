-- 0010 — Lapso de entrega, el nombre correcto de la tarifa, de dónde salió el
-- nombre del cliente y el método de lavado real de cada prenda.
--
-- Decisiones del dueño del 2026-09-23:
--   · La entrega es de 48 a 72 horas; la fecha exacta la acuerda el operador
--     en planta. El lapso sale del CRM, no del prompt.
--   · No hay «combo»: es una tarifa única de recogida y entrega, aparte del
--     lavado. La palabra combo desaparece del sistema.
--   · Un terno no se lava en agua. Cada prenda declara su método real.

-- 1. Lapso de entrega, configurable desde el CRM.
alter table configuracion
  add column horas_entrega_min integer not null default 48 check (horas_entrega_min > 0),
  add column horas_entrega_max integer not null default 72 check (horas_entrega_max > 0),
  add constraint configuracion_entrega_coherente
    check (horas_entrega_max >= horas_entrega_min);

-- 2. La tarifa de recogida y entrega deja de llamarse «combo».
alter table configuracion rename column tarifa_combo to tarifa_recoleccion_entrega;
alter table pedidos rename column monto_combo to monto_recoleccion_entrega;

comment on column configuracion.tarifa_recoleccion_entrega is
  'Tarifa única de recogida y entrega, aparte del costo del lavado.';

-- 3. De dónde salió el nombre del contacto. El agente puede corregir lo que
--    él mismo anotó o lo que vino del perfil de WhatsApp; lo que el dueño
--    escribió en el CRM no se toca nunca.
alter table clientes
  add column nombre_contacto_origen text not null default 'whatsapp'
    check (nombre_contacto_origen in ('whatsapp', 'cliente', 'crm'));

comment on column clientes.nombre_contacto_origen is
  'whatsapp = nombre del perfil (provisional) · cliente = lo dijo por WhatsApp · crm = lo escribió el equipo.';

-- Lo que ya está escrito a mano en el CRM se respeta desde hoy.
update clientes set nombre_contacto_origen = 'crm'
  where nombre_contacto is not null and canal_origen = 'presencial';

-- 4. El método de lavado real de cada prenda, según la lista del dueño.
--    Solo toca las filas que siguen en 'unico': si el dueño ya ajustó una en
--    el CRM, manda el CRM.
update servicios set metodo = 'seco' where metodo = 'unico' and nombre_item in (
  'Terno 3 piezas', 'Terno 2 piezas', 'Saco de terno', 'Pantalón de terno',
  'Abrigo liviano o gabardina', 'Abrigo pesado', 'Chal', 'Chaleco', 'Chompa',
  'Falda corta', 'Falda larga', 'Suéter de lana', 'Gorro', 'Bufanda',
  'Mandil', 'Mantel pequeño', 'Mantel mediano', 'Mantel grande',
  'Vestido corto', 'Vestido largo de fiesta', 'Vestido de primera comunión',
  'Vestido de novia sencillo', 'Vestido de novia con cola', 'Enterizo',
  'Edredón de plumas o en seco'
);

update servicios set metodo = 'agua' where metodo = 'unico' and nombre_item in (
  'Lavado, secado y doblado', 'Solo lavado', 'Solo secado',
  'Cortinas visillos', 'Cortinas pesadas', 'Mochila pequeña', 'Mochila grande',
  'Almohada', 'Cojín', 'Edredón 2 plazas', 'Edredón 2 plazas y media',
  'Edredón 3 plazas', 'Cobijas pequeñas', 'Juego de sábanas más 2 fundas',
  'Zapatos deportivos', 'Peluche grande', 'Peluche mediano', 'Peluche pequeño',
  'Alfombra de pelo corto', 'Alfombra de pelo alto', 'Pantalón que no es de terno'
);

-- Duvet, Tinturado y Chompa de cuero se quedan en 'unico': la lista del dueño
-- no les fija método (el duvet va en agua o en seco según la prenda).

-- Tener un método propio NO significa que haya que preguntarlo: solo se
-- pregunta cuando la misma prenda existe con varios métodos.
update servicios s set requiere_seleccion_metodo = (
  select count(*) > 1 from servicios o where o.nombre_item = s.nombre_item
);
