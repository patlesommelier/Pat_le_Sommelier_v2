-- Gestion des stocks : fournisseurs, stock et bouteilles en commande de chaque vin, commandes aux fournisseurs.

-- Fournisseurs de vin d'un restaurant.
create table if not exists fournisseur (
  id text primary key,
  restaurant_id text not null references restaurant(id) on delete cascade,
  nom text not null,
  adresse text,
  tva text,
  contact text,
  telephone text,
  email text,
  cree_le timestamptz not null default now()
);
create index if not exists fournisseur_restaurant on fournisseur (restaurant_id, nom);

-- Stock d'un vin (en bouteilles, sur la ligne principale du vin : la bouteille, sinon la première contenance), 6 par défaut ;
-- bouteilles en commande ; fournisseur (sur toutes les lignes du vin).
alter table vin_carte add column if not exists stock int not null default 6;
alter table vin_carte add column if not exists en_commande int not null default 0;
alter table vin_carte add column if not exists fournisseur_id text references fournisseur(id) on delete set null;

-- Paramètres : seuil d'alerte « stock bas » et coordonnées du restaurant sur les bons de commande.
alter table restaurant add column if not exists stock_limite_basse int not null default 2;
alter table restaurant add column if not exists commande_societe text;
alter table restaurant add column if not exists commande_adresse text;
alter table restaurant add column if not exists commande_tva text;
alter table restaurant add column if not exists commande_contact text;
alter table restaurant add column if not exists commande_telephone text;
alter table restaurant add column if not exists commande_email text;

-- Commandes de vin à un fournisseur : ouvertes jusqu'à la réception (les bouteilles passent alors en stock).
create table if not exists commande (
  id text primary key,
  restaurant_id text not null references restaurant(id) on delete cascade,
  fournisseur_id text references fournisseur(id) on delete set null,
  fournisseur_nom text not null,
  numero int not null,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'recue', 'annulee')),
  cree_par text,
  cree_le timestamptz not null default now(),
  envoyee_le timestamptz,
  envoyee_a text,
  recue_le timestamptz
);
create index if not exists commande_restaurant on commande (restaurant_id, statut, cree_le desc);
create table if not exists commande_ligne (
  commande_id text not null references commande(id) on delete cascade,
  vin_id text references vin_carte(id) on delete set null,
  libelle text not null,
  detail text,
  quantite int not null check (quantite > 0),
  ordre int not null default 0
);
create index if not exists commande_ligne_commande on commande_ligne (commande_id, ordre);

alter table fournisseur enable row level security;
alter table commande enable row level security;
alter table commande_ligne enable row level security;
