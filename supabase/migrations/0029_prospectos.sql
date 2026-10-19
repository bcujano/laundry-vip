-- 0029 — Prospectos: negocios a los que VIP quiere venderles y que todavía NO le han escrito.
--
-- Un «lead» en este sistema es un teléfono que le escribió al agente (tabla conversaciones). Un
-- prospecto es lo contrario: un negocio de una lista (ProspectorVIP) al que se le escribe o llama
-- primero. Van en tabla propia a propósito: si se metieran en `clientes` o `conversaciones`, cien
-- negocios fríos falsearían la conversión de leads y los «clientes nuevos» del dashboard.
--
-- Cuando un prospecto responde, el agente lo atiende como a cualquier cliente y su fila en
-- `clientes`/`conversaciones` aparece sola; el estado «respondió» se DEDUCE de eso al leer, no se
-- guarda, para no tocar el camino caliente del webhook.

create table prospectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  -- Tal cual viene en la lista: «catering», «hogares de ancianos»…
  segmento text not null,
  -- E.164 (+593…). Null si la lista no trae teléfono utilizable.
  telefono text check (telefono is null or telefono ~ '^\+[1-9][0-9]{7,14}$'),
  tipo_telefono text not null check (tipo_telefono in ('celular', 'fijo', 'sin_telefono')),
  telefono_original text,
  direccion text,
  email text,
  sitio_web text,
  instagram text,
  google_maps text,
  rating numeric(2, 1),
  resenas integer,
  -- Dónde cae respecto del radio de recolección del local. «sin_ubicar»: no se pudo geocodificar.
  cobertura text not null default 'sin_ubicar'
    check (cobertura in ('dentro', 'fuera', 'dudoso', 'sin_ubicar')),
  distancia_km numeric(5, 2),
  -- nuevo: nadie le ha escrito · contactado: se le escribió/llamó · descartado: no vale la pena
  -- · no_contactar: pidió que no se le escriba (o hay que respetar que no).
  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'contactado', 'descartado', 'no_contactar')),
  primer_contacto_en timestamptz,
  canal_primer_contacto text check (canal_primer_contacto in ('plantilla_whatsapp', 'llamada', 'manual')),
  notas text not null default '',
  fuente text not null,
  fuente_ref text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Importar dos veces la misma hoja no duplica nada.
  unique (fuente, fuente_ref)
);

-- Un teléfono es de un solo prospecto; los que no tienen teléfono no chocan entre sí.
create unique index prospectos_telefono_idx on prospectos (telefono) where telefono is not null;
create index prospectos_estado_idx on prospectos (estado, tipo_telefono);

create trigger prospectos_updated_at before update on prospectos
  for each row execute function set_updated_at();

alter table prospectos enable row level security;

-- La escritura a prospectos por plantilla es OPT-IN del dueño: arranca apagada y con tope diario.
alter table configuracion
  add column prospeccion_automatica boolean not null default false,
  add column prospeccion_limite_diario integer not null default 10
    check (prospeccion_limite_diario between 1 and 50);

comment on column configuracion.prospeccion_automatica is
  'true = n8n le escribe a los prospectos con la plantilla prospecto_primer_contacto (aprobada por Meta). Apagado por defecto.';
comment on column configuracion.prospeccion_limite_diario is
  'Cuántos prospectos nuevos como máximo recibe el primer mensaje cada día.';
