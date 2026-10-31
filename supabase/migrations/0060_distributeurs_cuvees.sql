-- Vins des distributeurs reliés aux vins (cuvées) de la base de Pat ; choix fait à la main gardé d'un tarif à l'autre.
alter table distributeur_vin add column if not exists cuvee_id text references cuvee(id) on delete set null;
alter table distributeur_vin add column if not exists cuvee_manuel boolean not null default false;
create index if not exists distributeur_vin_cuvee_idx on distributeur_vin (cuvee_id);
