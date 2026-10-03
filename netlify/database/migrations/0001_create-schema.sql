-- Pat le sommelier — schéma (Netlify Database)
-- État final des anciennes migrations Supabase 0001 + 0002.
-- Modèle validé dans le document « Pat le sommelier — modèle de données » (octobre 2026).
-- Deux familles : le savoir de Pat (commun à tous les restaurants) et les bases de chaque restaurant.

-- ─────────────────────────────── Types ───────────────────────────────
create type statut_validation as enum ('valide', 'propose', 'retire');
create type principe_role as enum ('methode', 'interaction', 'exclusion', 'plafond', 'service');
create type statut_production as enum (
  'conventionnel-raisonne', 'biologique', 'biologique-certifie',
  'biodynamie', 'biodynamie-certifiee', 'nature', 'inconnu'
);
create type gamme_prix as enum ('<15', '15-30', '30-50', '50-100', '100-300', '>300');
create type couleur_vin as enum ('bulles', 'blanc', 'rose', 'rouge', 'orange', 'doux');
create type categorie_plat as enum ('entree', 'plat', 'dessert', 'fromage');
create type origine_accord as enum ('pat', 'sommelier');
create type statut_accord as enum ('propose', 'valide', 'refuse');
create type type_regle as enum ('mettre_en_avant', 'exclure', 'prix', 'service', 'nombre_propositions', 'ton');
create type portee_regle as enum ('tout', 'couleur', 'plat', 'vin');

-- ───────────────────────────── Savoir de Pat ─────────────────────────────
create table principe (
  id              text primary key,             -- ex. friture-bulles
  numero          integer not null unique,      -- numéro d'affichage, stable
  titre           text not null,
  regle           text not null,                -- texte de Pat, jamais réécrit par l'app
  tags            text[] not null default '{}',
  role            principe_role,                -- comment l'app l'utilise (proposé par Claude, à valider)
  statut          statut_validation not null default 'valide',
  version_ajout   text,                         -- V3, V4, V5…
  principes_lies  text[] not null default '{}',
  maj_le          timestamptz not null default now()
);

create table question_pat (
  numero        integer primary key,
  question      text not null,
  principes     text[] not null default '{}',   -- ids de principes concernés
  reponse       text,
  repondu_le    date
);

create table terroir (
  id                text primary key,           -- <région>-terr-<nom>
  ancien_id         text,
  nom               text not null,
  type              text not null,              -- type d'origine des fichiers de Pat (DOC, DOCG, climat…)
  niveau            text not null default 'appellation'
                    check (niveau in ('appellation', 'zone', 'cru', 'lieu-dit', 'autre')),
  parent_id         text references terroir(id) on delete set null,
  pays              text,
  region            text,
  sous_region       text,
  cepages_rois      text[] not null default '{}',
  altitude_min      integer,                    -- mètres
  altitude_max      integer,
  sols              text[] not null default '{}',
  caracteristiques  text,
  notes_objectives  text,
  niveau_reference  smallint check (niveau_reference between 1 and 5),
  ranking_pat       smallint check (ranking_pat between 1 and 5),
  avis_critique     text,                       -- « mes_notes »
  avis_pat          text,                       -- « notes_pat »
  tags              text[] not null default '{}',
  source            text,
  statut            statut_validation not null default 'valide',
  maj_le            timestamptz not null default now()
);
create index on terroir (parent_id);
create index on terroir (niveau);
create index on terroir (region);

create table producteur (
  id                  text primary key,         -- <région>-prod-<nom>
  ancien_id           text,
  nom                 text not null,
  pays                text,
  region              text,
  sous_region         text,
  localisation        text,
  appellations_texte  text[] not null default '{}',  -- telles qu'écrites dans la fiche
  statut_production   statut_production not null default 'inconnu',
  statut_precision    text,
  couleurs            text[] not null default '{}',
  cepages_rois        text[] not null default '{}',
  niveau_reference    smallint check (niveau_reference between 1 and 5),
  ranking_pat         smallint check (ranking_pat between 1 and 5),
  connu_de_pat        boolean,
  gamme_prix          gamme_prix,
  notes_objectives    text,
  avis_critique       text,                     -- ancien « mes_notes »
  avis_pat            text,                     -- ancien « notes_pat »
  tags                text[] not null default '{}',
  source              text,
  lpv_pages           integer,
  a_verifier          text,
  statut              statut_validation not null default 'valide',
  maj_le              timestamptz not null default now()
);
create index on producteur (region);

-- Appellations d'un producteur, reliées aux terroirs quand le nom est reconnu
create table producteur_terroir (
  producteur_id  text references producteur(id) on delete cascade,
  terroir_id     text references terroir(id) on delete cascade,
  primary key (producteur_id, terroir_id)
);

create table cuvee (
  id              text primary key,
  producteur_id   text not null references producteur(id) on delete cascade,
  nom             text not null,
  appellation_id  text references terroir(id) on delete set null,
  couleur         couleur_vin,
  cepages         text,
  garde           text,
  description     text,
  texte_origine   text,                         -- phrase d'origine de « cuvees_phares »
  statut          statut_validation not null default 'propose'  -- conversion automatique, à relire par Pat
);
create index on cuvee (producteur_id);

-- ───────────────────────────── Restaurants ─────────────────────────────
create table restaurant (
  id               text primary key,            -- lola, bercuit, hkc
  nom              text not null,
  couleur          text not null,               -- couleur du bandeau, ex. #BA4037
  couleur_claire   text not null,               -- fond de la barre Pat
  logo_url         text,
  accroche         text,                        -- « Bienvenue chez Lola, … »
  police_titres    text
);

create table plat (
  id                 text primary key,          -- lola-solettes-meuniere
  restaurant_id      text not null references restaurant(id) on delete cascade,
  nom                text not null,
  nom_court          text,                      -- libellé des bulles de l'accueil
  categorie          categorie_plat not null,
  prix               numeric(7,2),
  prix_variantes     text,                      -- ex. « 1 pièce 12 € / 2 pièces 22 € »
  specialite_maison  boolean not null default false,
  variante_de        text references plat(id) on delete set null,
  a_verifier         text,
  actif              boolean not null default true,
  ordre              integer not null default 0
);
create index on plat (restaurant_id);

create table profil_accord (
  plat_id              text primary key references plat(id) on delete cascade,
  ancrages             text[] not null default '{}',
  profil               text,
  couleurs_ok          couleur_vin[] not null default '{}',
  cepages_conseilles   text[] not null default '{}',
  a_eviter             text,
  temperature_service  text,
  principes            text[] not null default '{}',   -- ids de principes
  plafond              smallint check (plafond between 1 and 5),
  version_principes    text,
  texte_complet        text                              -- analyse d'origine, pour relecture
);

create table vin_carte (
  id                  text primary key,         -- code de la carte : L-B02
  restaurant_id       text not null references restaurant(id) on delete cascade,
  couleur             couleur_vin not null,
  section             text,                     -- sous-titre affiché (Loire, Bourgogne…)
  libelle             text not null,
  producteur_id       text references producteur(id) on delete set null,
  producteur_texte    text,                     -- tel qu'écrit sur la carte
  cuvee_id            text references cuvee(id) on delete set null,
  appellation_id      text references terroir(id) on delete set null,
  vin_texte           text,
  millesime           text,
  format              text not null default '75 cl',
  prix                numeric(7,2),
  prix_verre          numeric(7,2),
  cepages             text,
  profil_degustation  jsonb,                    -- {douceur, acidite, corps, intensite, tanins, boise, effervescence, aromes[], stade}
  descriptif          text,
  presentation        text,
  resume_court        text,
  etiquette_url       text,
  coup_de_coeur       boolean not null default false,
  disponible          boolean not null default true,
  a_verifier          text,
  ordre               integer not null default 0,
  ranking_producteur  smallint check (ranking_producteur between 0 and 5),
  ranking_terroir     smallint check (ranking_terroir between 0 and 5),
  pays                text
);
create index on vin_carte (restaurant_id);

create table accord (
  id                     bigint generated always as identity primary key,
  restaurant_id          text not null references restaurant(id) on delete cascade,
  plat_id                text not null references plat(id) on delete cascade,
  vin_id                 text not null references vin_carte(id) on delete cascade,
  note                   smallint check (note between 1 and 5),
  rang                   smallint,
  explication            text,                  -- phrase courte (cartes Propositions)
  explication_longue     text,                  -- encadré « Avec vos … » de la fiche vin
  principes              text[] not null default '{}',
  service                text,
  origine                origine_accord not null default 'pat',
  statut                 statut_accord not null default 'propose',
  commentaire_sommelier  text,
  calcule_le             timestamptz not null default now(),
  valide_le              timestamptz,
  unique (plat_id, vin_id)
);
create index on accord (plat_id, statut);

create table regle_sommelier (
  id             text primary key,
  restaurant_id  text not null references restaurant(id) on delete cascade,
  type           type_regle not null,
  portee         portee_regle not null default 'tout',
  cible          text,                          -- id de vin, de plat ou couleur selon la portée
  valeur         text,
  texte          text not null,
  priorite       smallint not null default 1,
  actif          boolean not null default true,
  date_debut     date,
  date_fin       date
);

-- Règles de sélection du restaurant (fichier regles_selection.xlsx), gardées pour référence et affichage.
create table regle_selection (
  id             text primary key,               -- lola-plat-seul-2bis
  restaurant_id  text not null references restaurant(id) on delete cascade,
  onglet         text not null,                  -- Plat seul, Plusieurs plats, Tour 2 et verre…
  ordre          text not null,                  -- 1, 2, 2 bis…
  rang           smallint not null,              -- position dans l'onglet (tri)
  nom            text not null,
  type           text,                           -- Filtre, Classement, Départage, Ajout…
  enonce         text not null,
  statut         text,                           -- Validé / À confirmer (…)
  version        text                            -- V7 — 30/09/2026
);
create index on regle_selection (restaurant_id, onglet, rang);

-- La base n'est lue que par le serveur de l'app (pages et API) : pas d'accès public, donc pas de RLS.
