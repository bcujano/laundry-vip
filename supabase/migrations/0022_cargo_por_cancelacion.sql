-- 0022 — Cargo por cancelar con la ropa ya recogida (decisión del dueño, 2026-10-09).
--
-- Se cobra por tramo, a la tarifa vigente de recolección y entrega (hoy $2,50 cada uno):
--   · cancela y retira la ropa en planta  → solo el tramo de recogida
--   · cancela y pide que se la devuelvan  → recogida + devolución
-- Si la ropa aún no se había recogido, o el cliente la traía él mismo, no hay cargo.
-- `monto_cancelacion` queda en null cuando no hay cargo.

alter table pedidos
  add column monto_cancelacion numeric(10, 2)
    check (monto_cancelacion is null or monto_cancelacion >= 0),
  add column cancelacion_con_devolucion boolean not null default false;

comment on column pedidos.monto_cancelacion is
  'Cargo por cancelar con la ropa ya recogida (por tramo). null = sin cargo.';
comment on column pedidos.cancelacion_con_devolucion is
  'true si, al cancelar, el cliente pidió que le devolvieran la ropa a domicilio (suma el tramo de devolución).';
