-- 0008 — Última vez que cada número autorizado le escribió al agente.
-- Meta deja mandar texto libre solo dentro de las 24 h desde el último mensaje
-- del usuario; fuera de esa ventana hace falta una plantilla aprobada. El
-- resumen de las 8:00 usa esta hora para elegir cuál de las dos mandar.

alter table operador_whitelist add column ultimo_mensaje_en timestamptz;
