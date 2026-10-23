-- Marca las conversaciones cuyo último mensaje entrante fue una respuesta automática (bot, menú, contestador
-- de otro negocio). Mientras esté en true, el agente no insiste con seguimientos. Si luego escribe una persona,
-- vuelve a false.
alter table conversaciones
  add column respuesta_automatica boolean not null default false;

comment on column conversaciones.respuesta_automatica is
  'true = el último mensaje entrante parece un bot o contestador automático; no se le hacen seguimientos.';
