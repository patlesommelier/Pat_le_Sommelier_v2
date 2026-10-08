-- Comparaison de modèles Claude sur les accords de quelques plats (super-admin) : rien n'est enregistré dans les
-- accords, chaque génération est faite dans une transaction annulée ; seul le résultat côte à côte est gardé ici.
create table if not exists comparaison_modeles (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  text not null references restaurant(id) on delete cascade,
  plats          text[] not null,
  modeles        text[] not null,
  statut         text not null default 'en_attente',   -- en_attente, en_cours, fait, erreur
  resultat       jsonb,
  message        text,
  demande_par    text,
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);
create index if not exists comparaison_modeles_idx on comparaison_modeles (cree_le desc);
alter table comparaison_modeles enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on comparaison_modeles from anon, authenticated;
  end if;
end $$;
