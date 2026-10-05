-- Pat le sommelier — migration 0015 : inscription d'un restaurant par lui-même (/inscription).
-- Avant la création du compte, l'inscription vit dans la table « inscription », retrouvée par un jeton aléatoire
-- posé en cookie httpOnly (seule son empreinte SHA-256 est stockée). Les fichiers envoyés (menu, carte, logo)
-- sont gardés dans la base et effacés avec l'inscription. Tout est réservé au serveur : aucune politique,
-- aucun droit pour la clé publique de Supabase.

create table if not exists inscription (
  id                  uuid primary key default gen_random_uuid(),
  jeton_empreinte     text not null unique,
  statut              text not null default 'en_cours' check (statut in ('en_cours', 'compte_cree', 'finalisee', 'expiree')),
  plats               jsonb not null default '[]',      -- [{ nom, categorie, description }]
  vins                jsonb not null default '[]',      -- [{ libelleCarte, producteur, …, vinId, producteurStatut }] : jamais de ranking
  logo_fichier        uuid,                             -- inscription_fichier du logo retenu
  couleur             text check (couleur ~* '^#[0-9a-f]{6}$'),
  couleurs_proposees  jsonb not null default '[]',
  logo_clair          boolean,
  analyses            integer not null default 0,       -- lectures du menu et de la carte (limitées)
  nom_restaurant      text,
  ville               text,
  email               text,
  user_id             uuid,
  restaurant_id       text references restaurant(id) on delete set null,
  cree_le             timestamptz not null default now(),
  maj_le              timestamptz not null default now(),
  expire_le           timestamptz not null
);
create index if not exists inscription_expire_idx on inscription (expire_le);

create table if not exists inscription_fichier (
  id              uuid primary key default gen_random_uuid(),
  inscription_id  uuid not null references inscription(id) on delete cascade,
  type            text not null check (type in ('menu', 'carte', 'logo')),
  nom             text not null,
  media_type      text not null,
  octets          bytea not null,
  cree_le         timestamptz not null default now()
);
create index if not exists inscription_fichier_idx on inscription_fichier (inscription_id, type);

-- Limite par adresse IP (empreinte salée, jamais l'adresse en clair).
create table if not exists inscription_tentative (
  id            bigint generated always as identity primary key,
  ip_empreinte  text not null,
  cree_le       timestamptz not null default now()
);
create index if not exists inscription_tentative_idx on inscription_tentative (ip_empreinte, cree_le);

-- Restaurants : origine (créé par Pat dans le super-admin, ou inscrit seul).
alter table restaurant add column if not exists origine text not null default 'super_admin'
  check (origine in ('super_admin', 'inscription'));

alter table inscription enable row level security;
alter table inscription_fichier enable row level security;
alter table inscription_tentative enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on inscription, inscription_fichier, inscription_tentative from anon, authenticated;
  end if;
end $$;
