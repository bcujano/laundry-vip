-- 0025 — Políticas del negocio que el agente consulta (fase 2 del cuestionario de Sol).
--
-- Regla 13: lo que el agente promete sale de Configuración, no del prompt. Las políticas son
-- las respuestas «de criterio» (promociones, vacaciones, ropa que no se retira, facturas, pérdida
-- o daño, exprés, capacidad, recargos...). Sol las edita en el CRM sin pedirnos nada; el agente
-- las lee con la herramienta consultar_politica y dice solo lo que la política dice.
-- Una política sin regla escrita (regla = '') significa «lo decide el equipo»: el agente no
-- inventa nada y deriva con la frase guía.

create table politicas (
  id uuid primary key default gen_random_uuid(),
  tema text not null unique check (tema ~ '^[a-z0-9_]{3,40}$'),
  titulo text not null,
  regla text not null default '',
  quien_decide text not null default 'equipo' check (quien_decide in ('agente', 'equipo', 'duena')),
  plazo_respuesta text not null default '',
  frase_guia text not null default '',
  activa boolean not null default true,
  actualizado_en timestamptz not null default now()
);

comment on table politicas is
  'Reglas de criterio del negocio que el agente consulta (editables en Configuración).';
comment on column politicas.quien_decide is
  'agente = puede responderlo con la regla; equipo/duena = el agente solo deriva con la frase guía.';

alter table politicas enable row level security;

insert into politicas (tema, titulo, quien_decide, frase_guia) values
  ('promociones', 'Promociones y descuentos', 'equipo',
   'Las promociones vigentes las confirma el equipo; no hay descuentos por negociación.'),
  ('vacaciones_feriados', 'Vacaciones y feriados', 'equipo',
   'Déjeme confirmar con el equipo cómo atendemos ese día y le aviso.'),
  ('ropa_no_retirada', 'Ropa que no se retira a tiempo', 'duena',
   'Eso lo coordina directamente la administración; le paso con una persona.'),
  ('facturas', 'Facturación', 'equipo',
   'La factura la gestiona el equipo; indíqueme sus datos y ellos se la envían.'),
  ('perdida_o_dano', 'Prenda perdida o dañada', 'duena',
   'Lamento lo ocurrido: le paso de inmediato con la administración para revisarlo con usted.'),
  ('express_urgente', 'Servicio exprés o urgente', 'equipo',
   'Los plazos son los que le indiqué; si necesita algo urgente, lo consulto con el equipo.'),
  ('capacidad_volumen', 'Capacidad diaria y volúmenes grandes', 'equipo',
   'Para volúmenes grandes lo coordina el equipo según la capacidad del día.'),
  ('recargos', 'Recargos (manchas difíciles, olores, piezas especiales)', 'equipo',
   'Cualquier recargo lo confirma planta al revisar la prenda; no se cotiza antes.'),
  ('servicios_no_ofrecidos', 'Servicios fuera del catálogo', 'equipo',
   'Déjeme confirmarlo con el equipo y le digo; nunca se le dice que no se hace.'),
  ('formas_de_pago', 'Formas de pago', 'equipo',
   'Los pagos se coordinan con el equipo; por este chat no se piden ni confirman montos.')
on conflict (tema) do nothing;
