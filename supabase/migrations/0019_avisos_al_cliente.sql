-- 0019 — Avisos automáticos al cliente por una discrepancia.
--
-- Decisión del dueño (2026-09-30): cuando el conteo en planta no coincide con lo
-- declarado, o un monto se corrige, el cliente recibe un aviso informativo sin
-- esperar a que alguien se acuerde. El texto lo arma el SERVIDOR con datos de la
-- base (nunca el modelo), no pide ni recibe dinero y no negocia. Si la ventana de
-- 24 h de WhatsApp está cerrada no se puede escribir texto libre: queda para que
-- una persona llame o escriba.

create table avisos_cliente (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos (id) on delete cascade,
  telefono text not null,
  tipo text not null check (tipo in ('discrepancia_conteo', 'correccion_monto')),
  texto text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviado', 'requiere_persona')),
  created_at timestamptz not null default now(),
  resuelto_en timestamptz
);

create index avisos_cliente_estado_idx on avisos_cliente (estado, created_at);
create unique index avisos_cliente_unico_idx on avisos_cliente (pedido_id, texto);

alter table avisos_cliente enable row level security;
