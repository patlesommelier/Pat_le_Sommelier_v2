-- Vins passés « sans alcool » dans la base de Pat avant que la couleur soit reportée sur les cartes :
-- leurs vins de carte reliés passent aussi dans la catégorie « sans alcool ».
update vin_carte v set couleur = 'sans_alcool'
  from cuvee c
 where c.id = v.cuvee_id and c.couleur = 'sans_alcool' and v.couleur <> 'sans_alcool';
