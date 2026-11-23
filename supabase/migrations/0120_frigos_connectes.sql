-- Frigos connectés WineMS (bouteilles en consignation, LVQNEP) : relus depuis WineMS toutes les quelques minutes.
-- Un restaurant est relié à son client WineMS ; chaque frigo garde son état (connexion, température) et ses bouteilles présentes.
alter table restaurant add column if not exists winems_client_id text;

create table if not exists frigo (
  id                text primary key,            -- identifiant du frigo dans WineMS
  restaurant_id     text not null references restaurant(id) on delete cascade,
  nom               text not null,
  emplacement       text,
  capacite          int,
  statut            int,                         -- 0 connecté, 1 déconnecté, 2 en erreur
  statut_depuis     timestamptz,
  temperature       numeric(5,2),
  temperature_le    timestamptz,
  synchro_le        timestamptz not null default now()
);
create index if not exists frigo_restaurant_idx on frigo (restaurant_id);

create table if not exists frigo_bouteille (
  id                text primary key,            -- tag NFC de la bouteille (identifiant WineMS)
  frigo_id          text not null references frigo(id) on delete cascade,
  restaurant_id     text not null references restaurant(id) on delete cascade,
  emplacement       text,
  entree_le         timestamptz,
  millesime         int,
  winems_vin_id     text,
  nom               text not null,
  producteur        text,
  appellation       text,
  couleur           text,
  cepages           text,
  pays              text,
  prix_achat        numeric(10,2),               -- prix convenu avec le restaurant (HTVA)
  prix_conseille    numeric(10,2)                -- prix final conseillé
);
create index if not exists frigo_bouteille_frigo_idx on frigo_bouteille (frigo_id);
create index if not exists frigo_bouteille_restaurant_idx on frigo_bouteille (restaurant_id);
