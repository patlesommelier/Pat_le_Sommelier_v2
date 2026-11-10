-- Centre d'impression (espace restaurant) : un logo propre aux impressions (vide : celui de l'app) et le design de la
-- carte des vins imprimée (vide : « classique », celui d'avant), et l'impression en noir et blanc (carte, menu, suggestions).
alter table restaurant add column if not exists logo_impression_url text;
alter table restaurant add column if not exists design_impression text;
alter table restaurant add column if not exists impression_nb boolean not null default false;
