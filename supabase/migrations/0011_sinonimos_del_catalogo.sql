-- 0011 — Cómo llama el cliente a cada prenda.
--
-- El agente dijo «no ofrecemos servicio de tinturado» y «no lavamos zapatos»,
-- teniendo los dos en el catálogo: el cliente escribió «hacen tintura» y
-- «lavado de zapatos», y el emparejador solo conocía el nombre exacto.
--
-- Los sinónimos son datos del negocio, no código: el dueño los edita en el CRM
-- cuando descubra una palabra nueva con la que le escriben.

alter table servicios
  add column sinonimos text[] not null default '{}';

comment on column servicios.sinonimos is
  'Cómo lo nombra el cliente. El emparejador puntúa contra el nombre y contra cada sinónimo.';

-- Carga inicial. Solo toca las filas que nadie ha tocado todavía.
update servicios set sinonimos = datos.lista
from (values
  ('Lavado, secado y doblado', array['ropa','ropa suelta','ropa de diario','por libra','por peso','lavado por peso','canasta de ropa']),
  ('Solo lavado',              array['solo lavar','unicamente lavado']),
  ('Solo secado',              array['solo secar','secado de ropa']),
  ('Cortinas visillos',        array['visillo','cortina delgada','cortina liviana']),
  ('Cortinas pesadas',         array['cortina gruesa','blackout','cortina de sala']),
  ('Mochila pequeña',          array['mochila chica','morral']),
  ('Mochila grande',           array['mochila de viaje']),
  ('Almohada',                 array['almohadon']),
  ('Cojín',                    array['cojines decorativos']),
  ('Edredón 2 plazas',         array['cubrecama 2 plazas','edredon matrimonial','matrimonial']),
  ('Edredón 2 plazas y media', array['edredon queen','queen']),
  ('Edredón 3 plazas',         array['edredon king','king']),
  ('Edredón de plumas o en seco', array['plumon','edredon de plumas','edredon de pluma']),
  ('Duvet',                    array['cobertor duvet']),
  ('Cobijas pequeñas',         array['cobija','frazada','manta','cobertor']),
  ('Juego de sábanas más 2 fundas', array['sabana','juego de sabanas','sabanas y fundas']),
  ('Zapatos deportivos',       array['zapato','zapatilla','tenis','calzado','deportivos','zapatos de lona']),
  ('Peluche grande',           array['muneco grande','oso de peluche grande']),
  ('Peluche mediano',          array['muneco mediano']),
  ('Peluche pequeño',          array['muneco pequeno','peluche chico']),
  ('Alfombra de pelo corto',   array['tapete de pelo corto','alfombra corta']),
  ('Alfombra de pelo alto',    array['tapete de pelo alto','alfombra peluda','alfombra alta']),
  ('Terno 3 piezas',           array['traje 3 piezas','terno completo','terno de 3']),
  ('Terno 2 piezas',           array['traje','terno','traje 2 piezas']),
  ('Saco de terno',            array['saco','blazer']),
  ('Pantalón de terno',        array['pantalon de vestir']),
  ('Abrigo liviano o gabardina', array['gabardina','abrigo liviano','sobretodo']),
  ('Abrigo pesado',            array['abrigo','abrigo grueso']),
  ('Camisa o blusa',           array['camisa','blusa']),
  ('Camiseta',                 array['polo','playera','camiseta de algodon']),
  ('Chal',                     array['pashmina']),
  ('Chaleco',                  array['chaleco de plumon','chaleco de lana']),
  ('Chompa',                   array['casaca','chaqueta','chompa de lana']),
  ('Chompa de cuero',          array['casaca de cuero','chaqueta de cuero','cuero']),
  ('Falda corta',              array['falda','minifalda']),
  ('Falda larga',              array['falda hasta el piso']),
  ('Pantalón que no es de terno', array['pantalon','jean','jeans','bluyin']),
  ('Suéter de lana',           array['sueter','sweater','pullover']),
  ('Gorro',                    array['gorra']),
  ('Bufanda',                  array['chalina']),
  ('Mandil',                   array['delantal']),
  ('Mantel pequeño',           array['mantel chico']),
  ('Mantel mediano',           array['mantel']),
  ('Mantel grande',            array['mantel de banquete']),
  ('Vestido corto',            array['vestido']),
  ('Vestido largo de fiesta',  array['vestido de fiesta','vestido largo','vestido de gala']),
  ('Vestido de primera comunión', array['vestido de comunion','comunion']),
  ('Vestido de novia sencillo', array['vestido de novia','novia']),
  ('Vestido de novia con cola', array['novia con cola','vestido de novia con cola']),
  ('Enterizo',                 array['overol','jumpsuit']),
  ('Tinturado',                array['tintura','tinturar','tenido','tenir','tinte','cambio de color'])
) as datos(nombre, lista)
where servicios.nombre_item = datos.nombre and servicios.sinonimos = '{}';
