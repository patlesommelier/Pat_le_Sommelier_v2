-- Page « Les vins » : catégories du classement de la cave renommables (au départ, les couleurs ; ex. par région).
-- Vide : la catégorie de la couleur du vin.
alter table vin_carte add column if not exists cave_categorie text;
