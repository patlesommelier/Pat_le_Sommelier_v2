-- « Trouver un vin » : détail technique d'un échec, montré au super-admin seulement (jamais au restaurant).
alter table recherche_vin add column if not exists erreur text;
