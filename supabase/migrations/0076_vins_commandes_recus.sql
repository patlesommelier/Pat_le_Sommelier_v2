-- Vins ajoutés par une commande dont des bouteilles sont déjà arrivées : sur la carte (comme le fait désormais la réception).
update vin_carte set disponible = true, modifie_bo = now() where id like '%-qv-%' and not disponible and stock > 0;
