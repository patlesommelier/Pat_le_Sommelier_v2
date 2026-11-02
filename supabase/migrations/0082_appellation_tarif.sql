-- Appellation lue dans le tarif d'un distributeur (colonne « Appellation ») : donnée au vin de la base qui n'en a pas.
alter table distributeur_vin add column if not exists appellation text;
