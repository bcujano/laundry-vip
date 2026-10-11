-- 0026 — «No me escriban más» (cuestionario de Sol, fase 3).
--
-- Cuando un cliente pide que no le escriban, el seguimiento no vuelve a contactarlo nunca.
-- La marca vive en la conversación; el agente la pone con la herramienta no_seguir.

alter table conversaciones
  add column no_seguir boolean not null default false;

comment on column conversaciones.no_seguir is
  'true = el cliente pidió que no le escriban más: ningún seguimiento automático lo contacta.';
