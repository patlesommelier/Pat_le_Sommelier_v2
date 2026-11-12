-- « La carte est complète » : le post-it n'a plus de lien vers la carte des vins (aussi pour ceux déjà envoyés).
update avis_restaurant set lien = null, lien_libelle = null where titre = 'La carte est complète';
