-- Pat le sommelier — migration 0009 : régénération des accords depuis le back-office
-- Un clic « Régénérer » crée une ligne par plat dans generation_accords ; une fonction Netlify d'arrière-plan
-- les traite (notes, commentaires et limite recalculés par Pat, accords validés directement).

create table if not exists generation_accords (
  id             bigint generated always as identity primary key,
  lot            uuid not null,                     -- un clic = un lot (un plat ou toute la carte)
  restaurant_id  text not null references restaurant(id) on delete cascade,
  plat_id        text not null references plat(id) on delete cascade,
  statut         text not null default 'en_attente' check (statut in ('en_attente', 'en_cours', 'fait', 'erreur')),
  message        text,
  demande_par    text,
  cree_le        timestamptz not null default now(),
  debut_le       timestamptz,
  fin_le         timestamptz
);
create index if not exists generation_accords_attente_idx on generation_accords (statut, id);
create index if not exists generation_accords_resto_idx on generation_accords (restaurant_id, cree_le desc);

-- Accords régénérés : l'import des fichiers ne les remplace plus (ni note, ni commentaire).
alter table accord add column if not exists regenere_le timestamptz;
