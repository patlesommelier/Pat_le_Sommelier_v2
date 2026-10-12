-- Vins sans alcool restés dans une autre catégorie (souvent rouge) : la carte les classait dans une rubrique « Sans alcool »,
-- ou une autre contenance du même vin est déjà « sans alcool ». Ils passent dans la catégorie « sans alcool ».
update vin_carte set couleur = 'sans_alcool'
 where couleur <> 'sans_alcool'
   and translate(lower(coalesce(section, '') || ' ' || libelle), 'éèê', 'eee') ~ '(sans alcool|desalcool|alcohol[- ]free|non[- ]alcoholic|0[,.]0 ?%)';
update vin_carte v set couleur = 'sans_alcool'
 where v.couleur <> 'sans_alcool'
   and exists (select 1 from vin_carte s where s.restaurant_id = v.restaurant_id and s.couleur = 'sans_alcool'
                 and lower(s.libelle) = lower(v.libelle) and coalesce(s.millesime, '') = coalesce(v.millesime, ''));
