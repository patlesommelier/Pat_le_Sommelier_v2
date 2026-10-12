-- Producteur précisé sur une seule contenance d'un vin (verre, bouteille, magnum… : lignes séparées de la carte) :
-- repris par les autres lignes du même vin (même restaurant, couleur et intitulé) qui n'en ont pas.
update vin_carte v
   set producteur_id = s.producteur_id, producteur_texte = coalesce(nullif(v.producteur_texte, ''), s.producteur_texte),
       ranking_producteur = coalesce(v.ranking_producteur, s.ranking_producteur)
  from (select distinct on (restaurant_id, couleur, lower(libelle)) restaurant_id, couleur, lower(libelle) as cle,
               producteur_id, producteur_texte, ranking_producteur
          from vin_carte where producteur_id is not null
         order by restaurant_id, couleur, lower(libelle), ordre) s
 where v.producteur_id is null and s.restaurant_id = v.restaurant_id and s.couleur = v.couleur and s.cle = lower(v.libelle);
