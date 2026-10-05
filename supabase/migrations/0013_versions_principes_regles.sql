-- Pat le sommelier — migration 0013
-- 1. Principes et règles par versions : un brouillon qu'on modifie, une version en service, l'historique.
-- 2. Publication en deux temps : préparation (recalcul sans rien mettre en ligne, changements visibles), puis confirmation.
-- 3. Plats : « sauce servie à part » (le principe n°44 ne s'applique que si oui).
-- 4. Producteurs : ranking suggéré (repris des cartes), trace de la validation ; rankings de 0 à 5.
-- Tout est réservé au serveur : aucune de ces tables n'est lisible avec la clé publique de Supabase.

create table if not exists principes_version (
  code          text primary key,                         -- V5, V6…
  statut        text not null check (statut in ('brouillon', 'en_service', 'remplacee', 'archivee')),
  schema        smallint not null default 1,
  principes     jsonb not null,                           -- [{ n, id, titre, regle, tags, statut: actif|archive, aRelire }]
  informations  jsonb not null default '{}',
  questions     jsonb not null default '[]',
  decisions     jsonb not null default '[]',
  differences   jsonb,                                    -- avec la version en service au moment de l'import
  source        jsonb,                                    -- { fichier, importePar, importeLe }
  cree_le       timestamptz not null default now(),
  maj_le        timestamptz not null default now(),       -- toute modification du brouillon le met à jour
  publie_le     timestamptz,
  publie_par    text
);
-- Un seul brouillon et une seule version en service à la fois.
create unique index if not exists principes_version_brouillon_idx on principes_version ((statut)) where statut = 'brouillon';
create unique index if not exists principes_version_service_idx on principes_version ((statut)) where statut = 'en_service';

create table if not exists regles_version (
  code        text primary key,                           -- V7, V8…
  statut      text not null check (statut in ('brouillon', 'en_service', 'remplacee', 'archivee')),
  parametres  jsonb not null,                             -- réglages par défaut de Pat (voir src/lib/selection.ts)
  notes       text,
  cree_le     timestamptz not null default now(),
  maj_le      timestamptz not null default now(),
  publie_le   timestamptz,
  publie_par  text
);
create unique index if not exists regles_version_brouillon_idx on regles_version ((statut)) where statut = 'brouillon';
create unique index if not exists regles_version_service_idx on regles_version ((statut)) where statut = 'en_service';

create table if not exists publication (
  id               uuid primary key default gen_random_uuid(),
  type             text not null check (type in ('principes', 'regles')),
  code             text not null,                         -- version publiée
  statut           text not null default 'en_preparation'
                   check (statut in ('en_preparation', 'preparee', 'confirmee', 'annulee')),
  version_maj_le   timestamptz not null,                  -- maj_le du brouillon préparé : refus si le brouillon a changé
  prepare_par      text,
  prepare_le       timestamptz not null default now(),
  confirme_par     text,
  confirme_le      timestamptz
);
create index if not exists publication_statut_idx on publication (statut, prepare_le desc);

-- Une ligne par plat recalculé : suivi de la préparation et changements visibles par le client.
create table if not exists publication_plat (
  publication_id  uuid not null references publication(id) on delete cascade,
  restaurant_id   text not null references restaurant(id) on delete cascade,
  plat_id         text not null references plat(id) on delete cascade,
  statut          text not null default 'en_attente' check (statut in ('en_attente', 'en_cours', 'fait', 'erreur')),
  message         text,
  debut_le        timestamptz,
  fin_le          timestamptz,
  changements     jsonb,                                  -- { entrent: [vin], sortent: [vin], notes: [{vin, avant, apres}] }
  primary key (publication_id, plat_id)
);
create index if not exists publication_plat_attente_idx on publication_plat (statut, publication_id);

-- Notes et commentaires calculés avec le brouillon, en attente de confirmation.
create table if not exists publication_accord (
  publication_id  uuid not null references publication(id) on delete cascade,
  restaurant_id   text not null references restaurant(id) on delete cascade,
  plat_id         text not null references plat(id) on delete cascade,
  vin_id          text not null references vin_carte(id) on delete cascade,
  note            smallint not null check (note between 1 and 5),
  explication     text,
  limite          text,
  primary key (publication_id, plat_id, vin_id)
);

-- Plats : true = condiment servi à part (n°44), false = composante du plat, null = pas encore renseigné.
alter table plat add column if not exists sauce_servie_a_part boolean;

-- Producteurs et terroirs : rankings de 0 à 5 (0 = pas de ranking), suggestion et trace de la validation.
alter table producteur drop constraint if exists producteur_ranking_pat_check;
alter table producteur add constraint producteur_ranking_pat_check check (ranking_pat between 0 and 5);
alter table terroir drop constraint if exists terroir_ranking_pat_check;
alter table terroir add constraint terroir_ranking_pat_check check (ranking_pat between 0 and 5);
alter table producteur add column if not exists ranking_suggere smallint check (ranking_suggere between 0 and 5);
alter table producteur add column if not exists valide_par text;
alter table producteur add column if not exists valide_le timestamptz;
alter table producteur add column if not exists motif_rejet text;

-- Suggestion pour les producteurs proposés : le ranking que Pat leur a donné sur les cartes.
update producteur p set ranking_suggere = x.rk
  from (select producteur_id, max(ranking_producteur) as rk from vin_carte
         where producteur_id is not null and ranking_producteur is not null group by producteur_id) x
 where p.id = x.producteur_id and p.ranking_suggere is null and p.statut = 'propose';

alter table principes_version enable row level security;
alter table regles_version enable row level security;
alter table publication enable row level security;
alter table publication_plat enable row level security;
alter table publication_accord enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on principes_version, regles_version, publication, publication_plat, publication_accord from anon, authenticated;
  end if;
end $$;
