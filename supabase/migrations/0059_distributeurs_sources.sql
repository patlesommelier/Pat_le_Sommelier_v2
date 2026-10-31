-- Distributeurs : logo, source du tarif (PDF, Excel ou API), modèle de Claude pour le lire, accès à l'API du distributeur.
alter table distributeur add column if not exists logo_url text;
alter table distributeur add column if not exists source text not null default 'fichier' check (source in ('fichier', 'api'));
alter table distributeur add column if not exists modele_lecture text not null default 'sonnet' check (modele_lecture in ('sonnet', 'haiku', 'opus'));
alter table distributeur add column if not exists api_url text;
alter table distributeur add column if not exists api_entete text;      -- nom de l'en-tête d'accès (ex. Authorization, X-API-Key)
alter table distributeur add column if not exists api_cle text;         -- secret : jamais renvoyé au navigateur
alter table distributeur add column if not exists api_synchro_le timestamptz;
