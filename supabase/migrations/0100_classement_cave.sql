-- Classement des vins dans la page « Les vins » (la cave), à part de celui de la carte : sous-catégories propres à la cave
-- (ex. emplacement : cave du bas, frigo…) et ordre des vins, réglés par le restaurant. Sans effet sur la carte ni sur l'app.
alter table vin_carte add column if not exists cave_rubrique text;
alter table vin_carte add column if not exists cave_ordre int;
