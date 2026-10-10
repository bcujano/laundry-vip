-- 0023 — Coordenadas de la planta, para verificar la cobertura por distancia en línea recta.
--
-- El radio (0013, 2,5 km) hasta ahora solo se verificaba por la lista de sectores (0015). Con la
-- dirección del cliente geocodificada (Google Maps o, sin llave, OpenStreetMap) se mide la
-- distancia real a la planta. La lista de sectores sigue de respaldo cuando no se puede
-- geocodificar. Las coordenadas son las del mapa publicado del local (De los Pinos y Pedro Barrios).

alter table configuracion
  add column local_latitud numeric(9, 6) not null default -0.138297
    check (local_latitud between -90 and 90),
  add column local_longitud numeric(9, 6) not null default -78.482037
    check (local_longitud between -180 and 180);

comment on column configuracion.local_latitud is 'Latitud de la planta (cobertura por distancia).';
comment on column configuracion.local_longitud is 'Longitud de la planta (cobertura por distancia).';
