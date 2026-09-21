-- 0009 — Precio promocional por cantidad.
--
-- La lista física de la planta trae promociones del tipo «cobijas pequeñas:
-- $5,00 c/u, 3 por $12,00». Hasta ahora el catálogo solo sabía cobrar por
-- paquete cerrado, así que una sola cobija se cotizaba a $12,00.
--
-- Con esta columna, cantidad_por_paquete + precio_paquete describen la
-- promoción y precio_min sigue siendo el precio de una unidad suelta.

alter table servicios
  add column precio_paquete numeric(10, 2) check (precio_paquete >= 0);

-- Una promoción sin cuántas prendas la arman no significa nada.
alter table servicios
  add constraint servicios_paquete_coherente
  check (precio_paquete is null or cantidad_por_paquete is not null);

comment on column servicios.precio_paquete is
  'Precio del paquete completo de cantidad_por_paquete unidades. Null = sin promoción.';
