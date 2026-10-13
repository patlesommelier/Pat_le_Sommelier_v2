-- Suggestions du moment : une catégorie de plats en plus (entrées, plats, desserts, fromages).
alter type categorie_plat add value if not exists 'suggestion';

-- Photos des suggestions envoyées par le restaurant : lues par Pat en arrière-plan (fonction lire-suggestions-background).
create table if not exists lecture_suggestions (
  id text primary key,
  restaurant_id text not null references restaurant(id) on delete cascade,
  statut text not null default 'a_lire' check (statut in ('a_lire', 'en_cours', 'ok', 'erreur')),
  remplacer boolean not null default true,
  message text,
  demande_par text,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
create index if not exists lecture_suggestions_restaurant on lecture_suggestions (restaurant_id, cree_le desc);
create table if not exists lecture_suggestions_fichier (
  lecture_id text not null references lecture_suggestions(id) on delete cascade,
  nom text not null,
  media_type text not null,
  octets bytea not null,
  ordre int not null default 0
);
alter table lecture_suggestions enable row level security;
alter table lecture_suggestions_fichier enable row level security;
