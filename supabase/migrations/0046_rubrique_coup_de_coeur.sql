-- Rubrique « Coup(s) de cœur (du sommelier) » lue sur une carte : ce n'est pas une région. Les vins deviennent des coups de cœur
-- de la maison (petit cœur, catégorie « Coups de cœur ») et quittent cette rubrique.
update vin_carte set coup_de_coeur = true, section = null
 where translate(lower(coalesce(section, '')), 'œ', 'o') ~ 'coups? de coe?ur';
