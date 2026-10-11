-- Vins des cartes sans cépages (la lecture des cartes ne les relevait pas) : repris du vin de la base de Pat relié.
update vin_carte v set cepages = c.cepages
  from cuvee c
 where c.id = v.cuvee_id and coalesce(v.cepages, '') = '' and coalesce(c.cepages, '') <> '';
