-- Vins lus sur la carte à l'inscription : ce qui a été lu (nom, producteur, appellation, millésime), gardé tel quel.
-- Non vide = vin suivi dans « Ma cave » : « Reconnu » s'il est relié à un vin de la base de Pat (cuvee_id), sinon
-- « En attente de validation ». Vide pour les vins ajoutés autrement (aucune mention).
alter table vin_carte add column if not exists lu_sur_carte jsonb;
