-- Réception des bouteilles d'une commande, en une ou plusieurs fois : chaque réception (partielle ou complète)
-- a son bon de réception ; chaque ligne de commande compte ses bouteilles déjà reçues.
alter table commande_ligne add column if not exists recue int not null default 0;
create table if not exists reception (
  id text primary key,
  commande_id text not null references commande(id) on delete cascade,
  numero int not null,
  complete boolean not null default false,
  cree_par text,
  cree_le timestamptz not null default now()
);
create index if not exists reception_commande on reception (commande_id, numero);
create table if not exists reception_ligne (
  reception_id text not null references reception(id) on delete cascade,
  ordre int not null,
  libelle text not null,
  detail text,
  quantite int not null check (quantite > 0),
  commandee int not null,
  prix_achat numeric(10,2)
);
create index if not exists reception_ligne_reception on reception_ligne (reception_id, ordre);
alter table reception enable row level security;
alter table reception_ligne enable row level security;
-- Commandes déjà réceptionnées : toutes leurs bouteilles sont reçues.
update commande_ligne l set recue = l.quantite from commande c where c.id = l.commande_id and c.statut = 'recue' and l.recue = 0;
