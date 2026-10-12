-- Vins nature et bio : renseignés dans la base de Pat (par vin), repris par toutes les cartes.
alter table cuvee add column if not exists nature boolean not null default false;
alter table cuvee add column if not exists bio boolean not null default false;
-- Catégories en plus des couleurs dans l'app, choisies par le restaurant : nature, bio, coups de cœur.
alter table restaurant add column if not exists categories_carte text[] not null default '{}';
