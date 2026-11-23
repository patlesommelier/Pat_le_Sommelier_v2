-- Frigo connecté : photo de l'étiquette de chaque bouteille (adresse servie par WineMS), en vignette dans Ma cave.
alter table frigo_bouteille add column if not exists image_url text;
