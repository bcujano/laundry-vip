-- 0005 — RLS habilitado y denegando por defecto en las 14 tablas.
-- No se crean políticas: sin política, RLS niega todo. El acceso legítimo
-- entra con service_role desde el servidor, que ignora RLS por diseño de
-- Supabase. Esto es defensa en profundidad, no el control principal.

alter table staff                    enable row level security;
alter table clientes                 enable row level security;
alter table servicios                enable row level security;
alter table configuracion            enable row level security;
alter table operador_whitelist       enable row level security;
alter table pedidos                  enable row level security;
alter table pedido_items             enable row level security;
alter table pedido_eventos           enable row level security;
alter table correcciones_cotizacion  enable row level security;
alter table conversaciones           enable row level security;
alter table eventos_procesados       enable row level security;
alter table mensajes_diarios         enable row level security;
alter table uso_openai_diario        enable row level security;
alter table errores_agente           enable row level security;
