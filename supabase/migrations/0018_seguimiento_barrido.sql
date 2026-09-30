-- 0018 — Seguimientos de barrido.
--
-- El dueño pidió (2026-09-30) mandar el primer seguimiento a todos los leads con
-- ventana abierta, también a los que una persona del equipo ya había contestado.
-- Esos chats siguen con los pasos siguientes sin el filtro «ya le contestó una
-- persona»; solo los frena un pedido agendado o confirmado, la etiqueta humano o
-- una conversación resuelta.

alter table seguimientos add column barrido boolean not null default false;
