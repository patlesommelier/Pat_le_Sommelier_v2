-- Tarifs collés depuis le site d'un distributeur : référence de l'article, prix catalogue (barré), étiquettes.
alter table distributeur_vin add column if not exists reference text;          -- code article du distributeur (repris sur le bon de commande)
alter table distributeur_vin add column if not exists prix_catalogue numeric(10,2); -- prix avant la remise de Quid Vinum (pour mémoire)
alter table distributeur_vin add column if not exists image_source text;       -- adresse de l'image sur le site du distributeur
alter table distributeur_vin add column if not exists etiquette_url text;      -- notre copie de l'étiquette
-- Texte collé (et version « page web », pour les images) gardé comme les fichiers de tarif.
alter table distributeur_tarif add column if not exists html text;
-- Une cuvée peut recevoir son étiquette du site d'un distributeur.
alter table cuvee drop constraint if exists cuvee_etiquette_source_check;
alter table cuvee add constraint cuvee_etiquette_source_check check (etiquette_source in ('fichier', 'wine_labs', 'restaurant', 'distributeur'));
