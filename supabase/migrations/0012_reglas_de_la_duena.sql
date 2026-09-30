-- 0012 — Lo que ordena la dueña, sacado de sus propias respuestas en WhatsApp
-- el 2026-09-30, y dos arreglos del catálogo que salieron de revisar los chats.
--
-- El agente le prometió recogida en el sur a una clienta y María Sol tuvo que
-- desdecirlo («atendemos solo al norte de la ciudad»). También daba un horario
-- distinto al que ella dice. Nada de eso estaba en el CRM: ahora sí, y el
-- agente lo lee de ahí.

-- 1. Hasta dónde se recoge. Texto libre: lo edita la dueña en Configuración.
alter table configuracion
  add column zona_cobertura text not null default '';

comment on column configuracion.zona_cobertura is
  'Hasta dónde llega la recolección. Vacío = sin límite declarado.';

-- 2. El sábado se cierra más temprano que entre semana.
alter table configuracion
  add column hora_cierre_sabado time not null default '17:00';

comment on column configuracion.hora_cierre_sabado is
  'El local cierra antes los sábados; hora_cierre rige de lunes a viernes.';

-- 3. Lo que dijo la dueña: norte de Quito, de 9:00 a 19:00 y sábados hasta las 17:00.
update configuracion
set zona_cobertura = 'norte de Quito',
    hora_apertura = '09:00',
    hora_cierre = '19:00',
    hora_cierre_sabado = '17:00'
where id = 1;

-- 4. «deportivos» era demasiado genérico: «calentador deportivo» cotizaba como
--    un par de zapatos de $3,00.
update servicios
set sinonimos = array_remove(sinonimos, 'deportivos')
where nombre_item = 'Zapatos deportivos';

-- 5. Calentadores y busos son ropa de diario y van al peso, como dijo la dueña
--    («el lavado de ropa de casa es al peso»). No estaban ni como sinónimo.
update servicios
set sinonimos = sinonimos || array['calentador','buso','sudadera','pantaloneta','pijama','ropa interior','ropa de casa']
where nombre_item = 'Lavado, secado y doblado'
  and not ('calentador' = any(sinonimos));
