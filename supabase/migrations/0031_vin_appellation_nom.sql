-- Fiche vin du back-office : appellation et nom du vin modifiables par le restaurant.
-- Vides tant que le restaurant ne les a pas enregistrés : l'app les déduit alors de la carte importée (vin_texte).
alter table vin_carte add column if not exists appellation_texte text;
alter table vin_carte add column if not exists nom_vin text;
