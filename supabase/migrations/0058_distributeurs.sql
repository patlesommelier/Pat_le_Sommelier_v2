-- Distributeurs et importateurs de vin (Quid Vinum) : leurs tarifs (PDF), leurs vins au prix d'achat de Quid Vinum,
-- et le prix proposé aux restaurants (prix QV + marge du distributeur, ou prix imposé par vin).
-- Les restaurants ne voient jamais le prix QV ni la marge : seulement le prix proposé.

create table if not exists distributeur (
  id          text primary key,
  nom         text not null,
  adresse     text,
  tva         text,
  contact     text,
  telephone   text,
  email       text,
  site        text,
  marge       numeric(6,2) not null default 15,  -- % ajouté au prix QV
  remise_qv   numeric(6,2),                      -- % obtenu par Quid Vinum sur le tarif public (pour mémoire)
  notes       text,
  actif       boolean not null default true,     -- proposé aux restaurants
  -- Lecture du dernier tarif par Claude : en_cours, terminee, echec.
  lecture_statut  text check (lecture_statut in ('en_cours', 'terminee', 'echec')),
  lecture_message text,
  lecture_le      timestamptz,
  cree_le     timestamptz not null default now()
);
create unique index if not exists distributeur_nom_idx on distributeur (lower(nom));

-- Tarifs déposés (PDF), le plus récent sert à la lecture.
create table if not exists distributeur_tarif (
  id              text primary key,
  distributeur_id text not null references distributeur(id) on delete cascade,
  nom             text not null,
  media_type      text not null default 'application/pdf',
  octets          bytea not null,
  cree_le         timestamptz not null default now()
);
create index if not exists distributeur_tarif_idx on distributeur_tarif (distributeur_id, cree_le desc);

create table if not exists distributeur_vin (
  id               text primary key,
  distributeur_id  text not null references distributeur(id) on delete cascade,
  cle              text not null,          -- producteur, vin, millésime et contenance normalisés : retrouve le vin d'un tarif à l'autre
  section          text,                   -- région ou titre du tarif
  producteur_texte text,                   -- tel qu'écrit sur le tarif
  libelle          text not null,          -- appellation et cuvée, sans millésime ni contenance
  millesime        text,
  contenance       text,                   -- « 37,5 cl », « 150 cl » ; null : 75 cl
  couleur          text,
  certification    text,                   -- BIO, BIODY, RAI…
  prix_qv          numeric(10,2),          -- prix d'achat HTVA de Quid Vinum (tarif)
  prix_restaurant  numeric(10,2),          -- prix imposé aux restaurants (sinon : prix QV + marge)
  epuise           boolean not null default false,
  maximum          int,                    -- « Max. 6 » : bouteilles disponibles au plus
  producteur_id    text references producteur(id) on delete set null,
  producteur_manuel boolean not null default false, -- rattachement choisi par Pat : gardé à la lecture d'un nouveau tarif
  actif            boolean not null default true,   -- absent du dernier tarif : plus proposé
  ordre            int not null default 0,
  maj_le           timestamptz not null default now()
);
create unique index if not exists distributeur_vin_cle_idx on distributeur_vin (distributeur_id, cle);
create index if not exists distributeur_vin_producteur_idx on distributeur_vin (producteur_id);

-- Fournisseur d'un restaurant choisi dans la base de Quid Vinum : ses commandes partent chez Quid Vinum.
alter table fournisseur add column if not exists distributeur_id text references distributeur(id) on delete set null;
create unique index if not exists fournisseur_distributeur_idx on fournisseur (restaurant_id, distributeur_id) where distributeur_id is not null;
alter table vin_carte add column if not exists distributeur_vin_id text references distributeur_vin(id) on delete set null;
alter table commande_ligne add column if not exists distributeur_vin_id text references distributeur_vin(id) on delete set null;

alter table distributeur enable row level security;
alter table distributeur_tarif enable row level security;
alter table distributeur_vin enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on distributeur, distributeur_tarif, distributeur_vin from anon, authenticated;
  end if;
end $$;
