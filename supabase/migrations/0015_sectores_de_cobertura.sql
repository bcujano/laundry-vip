-- 0015 — Lista de sectores dentro del radio de recogida.
--
-- El radio (0013) es solo una frase que el agente lee: nada impedía agendar una
-- recogida fuera de él. Con esta lista el servidor compara el sector que dio el
-- cliente. Vacía = sin verificar (comportamiento anterior): la llena el dueño en
-- Configuración cuando tenga la lista de barrios.

alter table configuracion
  add column sectores_cobertura text[] not null default '{}';

comment on column configuracion.sectores_cobertura is
  'Barrios y sectores dentro del radio de recogida. Vacía = la cobertura no se verifica.';
