-- Étiquettes dans la base de Pat : rattachées à la cuvée (tous millésimes).
-- Une photo déposée pour le vin d'une carte (ou trouvée par Wine Labs) devient l'étiquette de sa cuvée ;
-- les autres cartes qui ont cette cuvée sans étiquette la reprennent (etiquette_source = 'cuvee').
alter table cuvee add column if not exists etiquette_url text;
alter table cuvee add column if not exists etiquette_source text check (etiquette_source in ('fichier', 'wine_labs', 'restaurant'));
alter table cuvee add column if not exists etiquette_vin_id text references vin_carte(id) on delete set null; -- vin d'où vient la photo
alter table cuvee add column if not exists etiquette_maj_le timestamptz;
alter table cuvee add column if not exists source text; -- 'carte' : cuvée créée depuis le vin d'une carte

alter table vin_carte drop constraint if exists vin_carte_etiquette_source_check;
alter table vin_carte add constraint vin_carte_etiquette_source_check
  check (etiquette_source in ('fichier', 'wine_labs', 'restaurant', 'cuvee'));
create index if not exists vin_carte_cuvee_idx on vin_carte (cuvee_id);
