-- Vins des cartes reliés (par une fusion) au vin de la base d'un autre producteur, alors que leur propre producteur
-- n'a plus aucun vin dans la base (tous fusionnés, ex. « Orestadi ») : ils prennent le producteur du vin de la base.
-- Sans cela, le partage des étiquettes les détacherait et recréerait le doublon.
update vin_carte v set producteur_id = c.producteur_id
  from cuvee c
 where c.id = v.cuvee_id and c.statut <> 'retire' and v.producteur_id is not null and v.producteur_id <> c.producteur_id
   and not exists (select 1 from cuvee k where k.producteur_id = v.producteur_id and k.statut <> 'retire')
   and exists (select 1 from cuvee k where k.producteur_id = v.producteur_id and k.statut = 'retire');
