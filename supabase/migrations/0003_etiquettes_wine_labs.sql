-- Pat le sommelier — migration 0003 : étiquettes Wine Labs
-- Les étiquettes viennent de trois sources : le dossier du restaurant (import), Wine Labs (webhook), ou une photo
-- ajoutée par le restaurant dans le back-office. Une photo du restaurant n'est jamais remplacée par Wine Labs.

alter table vin_carte add column if not exists etiquette_source text
  check (etiquette_source in ('fichier', 'wine_labs', 'restaurant'));
alter table vin_carte add column if not exists etiquette_statut text
  check (etiquette_statut in ('demandee', 'trouvee', 'introuvable', 'echec'));
update vin_carte set etiquette_source = 'fichier' where etiquette_url is not null and etiquette_source is null;

-- Une ligne par demande envoyée à Wine Labs (POST /wine_labels) ; le webhook la met à jour.
create table if not exists demande_etiquette (
  request_id     text primary key,               -- identifiant renvoyé par Wine Labs
  vin_id         text references vin_carte(id) on delete set null,
  restaurant_id  text references restaurant(id) on delete cascade,
  statut         text not null default 'demandee',  -- demandee, fulfilled, unavailable, failed
  image_url      text,
  payload        jsonb,                          -- dernier objet « request » reçu, tel quel
  demandee_le    timestamptz not null default now(),
  recue_le       timestamptz
);
create index if not exists demande_etiquette_vin_idx on demande_etiquette (vin_id);

-- Webhooks déjà traités (Wine Labs peut renvoyer le même message) : on ne les applique qu'une fois.
create table if not exists webhook_recu (
  id         text primary key,
  source     text not null,
  recu_le    timestamptz not null default now()
);

alter table demande_etiquette enable row level security;
alter table webhook_recu enable row level security;
-- Réservées au serveur (clé service).
