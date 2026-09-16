-- 0001 — Personal del negocio y clientes.

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create table staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol text not null check (rol in ('dueno', 'operador')),
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_updated_at before update on staff
  for each row execute function set_updated_at();

create table clientes (
  id uuid primary key default gen_random_uuid(),
  telefono text not null unique check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  nombre_contacto text,
  nombre_negocio text,
  tipo_negocio text not null default 'particular'
    check (tipo_negocio in ('clinica', 'restaurante', 'hotel', 'otro', 'particular')),
  canal_origen text not null
    check (canal_origen in ('whatsapp_agente', 'presencial', 'referral_ads')),
  modelo_facturacion text not null default 'por_pedido'
    check (modelo_facturacion in ('por_pedido', 'consolidado_mensual')),
  saldo_acumulado numeric(10, 2) not null default 0,
  aviso_privacidad_enviado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clientes_updated_at before update on clientes
  for each row execute function set_updated_at();

create index clientes_tipo_negocio_idx on clientes (tipo_negocio);
