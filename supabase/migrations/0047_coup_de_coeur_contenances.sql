-- Coup de cœur coché sur une seule contenance d'un vin : il vaut pour toutes ses contenances (même restaurant, couleur, intitulé, millésime).
update vin_carte v set coup_de_coeur = true
 where not v.coup_de_coeur
   and exists (select 1 from vin_carte s where s.restaurant_id = v.restaurant_id and s.coup_de_coeur and s.couleur = v.couleur
                 and lower(s.libelle) = lower(v.libelle) and coalesce(s.millesime, '') = coalesce(v.millesime, ''));
