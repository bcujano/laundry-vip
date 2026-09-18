-- 0007 — Dos niveles de acceso para los WhatsApp autorizados.
--   operador: registra órdenes presenciales, cuenta en planta y avanza estados.
--   admin:    además pide reportes, resúmenes y la lista de lo que requiere atención.
-- Nada de dinero se mueve por WhatsApp: pagos, montos y discrepancias solo en el CRM.

alter table operador_whitelist
  add column nivel text not null default 'operador'
    check (nivel in ('operador', 'admin'));
