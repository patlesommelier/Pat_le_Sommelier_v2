-- Pat le sommelier — migration 0003 (Netlify Database ; = supabase/migrations/0002, sans RLS)
-- 1. Terroirs : les fichiers de Pat utilisent une quarantaine de types (DOC, DOCG, sottozona, contrada, coteau…).
--    Le type d'origine est gardé tel quel ; « niveau » le range dans une des cinq familles utilisées par l'app.
-- 2. Terroirs : « mes_notes » (avis critique) et « notes_pat » (avis de Pat) sont deux champs distincts.
-- 3. Carte des vins : ranking producteur, ranking terroir et pays, tels que les règles de sélection V7 les définissent.
-- 4. Règles de sélection du restaurant (fichier regles_selection.xlsx), gardées pour référence et affichage.

alter table terroir alter column type type text using type::text;
drop type if exists terroir_type;
alter table terroir add column if not exists niveau text not null default 'appellation'
  check (niveau in ('appellation', 'zone', 'cru', 'lieu-dit', 'autre'));
alter table terroir add column if not exists avis_critique text;
create index if not exists terroir_niveau_idx on terroir (niveau);

alter table vin_carte add column if not exists ranking_producteur smallint check (ranking_producteur between 0 and 5);
alter table vin_carte add column if not exists ranking_terroir smallint check (ranking_terroir between 0 and 5);
alter table vin_carte add column if not exists pays text;

create table if not exists regle_selection (
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
create index if not exists regle_selection_resto_idx on regle_selection (restaurant_id, onglet, rang);
