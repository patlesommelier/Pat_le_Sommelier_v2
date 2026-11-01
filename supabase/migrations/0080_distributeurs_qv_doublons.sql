-- Vins de la carte d'un distributeur Quid Vinum activé, mais rattachés à un distributeur du même nom saisi à la main
-- (« Les Vents d'Anges » de la carte importée) : ils passent au distributeur Quid Vinum.
update vin_carte v set fournisseur_id = q.id
  from fournisseur m join distributeur d on lower(trim(d.nom)) = lower(trim(m.nom))
       join fournisseur q on q.distributeur_id = d.id and q.restaurant_id = m.restaurant_id
 where v.fournisseur_id = m.id and m.distributeur_id is null and v.restaurant_id = m.restaurant_id;
-- Vins de la carte reliés au catalogue d'un distributeur Quid Vinum activé, sans distributeur : il devient le leur.
update vin_carte v set fournisseur_id = f.id
  from distributeur_vin dv join fournisseur f on f.distributeur_id = dv.distributeur_id
 where v.distributeur_vin_id = dv.id and f.restaurant_id = v.restaurant_id and v.fournisseur_id is null;
