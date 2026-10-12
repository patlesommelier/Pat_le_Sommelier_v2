-- Page d'arrivée de l'app des clients (QR code) : le menu avec le sommelier, ou la carte des vins.
alter table restaurant add column if not exists page_accueil text not null default 'menu' check (page_accueil in ('menu', 'carte'));
