-- Pat le sommelier — migration 0012 : présentations de la carte imprimée générées avant l'impression
-- Le bouton « Imprimer la carte » crée une ligne par couleur où des vins n'ont pas encore de présentation ;
-- une fonction Netlify d'arrière-plan les traite, puis la carte s'ouvre.
create table if not exists generation_presentations (
  id             bigint generated always as identity primary key,
  lot            uuid not null,
  restaurant_id  text not null references restaurant(id) on delete cascade,
  couleur        text not null,
  statut         text not null default 'en_attente' check (statut in ('en_attente', 'en_cours', 'fait', 'erreur')),
  message        text,
  demande_par    text,
  cree_le        timestamptz not null default now(),
  debut_le       timestamptz,
  fin_le         timestamptz
);
create index if not exists generation_presentations_attente_idx on generation_presentations (statut, id);
create index if not exists generation_presentations_resto_idx on generation_presentations (restaurant_id, cree_le desc);
