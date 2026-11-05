-- Consommation de l'API Claude, appel par appel : poste (lecture carte, accords…), restaurant ou inscription, modèle,
-- jetons et recherches web. Le coût est calculé à l'affichage (page Consommation du super-admin).
create table if not exists consommation_claude (
  id             bigserial primary key,
  quand          timestamptz not null default now(),
  poste          text not null,
  restaurant_id  text,
  inscription_id text,
  modele         text not null,
  entree         int not null default 0,
  sortie         int not null default 0,
  cache_lu       int not null default 0,
  cache_ecrit    int not null default 0,
  recherches     int not null default 0
);
create index if not exists consommation_claude_quand on consommation_claude (quand desc);
alter table consommation_claude enable row level security;
