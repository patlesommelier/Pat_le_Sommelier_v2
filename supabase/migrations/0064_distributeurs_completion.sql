-- Vins d'un distributeur complétés (cépages, appellation) d'après son site public : avancement de la recherche.
alter table distributeur add column if not exists completion_statut text check (completion_statut in ('en_cours', 'terminee', 'echec'));
alter table distributeur add column if not exists completion_message text;
alter table distributeur add column if not exists completion_le timestamptz;
