-- Inventaire de la cave : le restaurant compte ses bouteilles dans une page dédiée (le stock ne se change plus dans la liste
-- des vins, à côté du prix de vente). Chaque inventaire validé est gardé, avec le stock avant et après de chaque vin,
-- pour calculer plus tard la consommation (stock début + achats reçus − stock fin). Le tableau de bord rappelle l'inventaire
-- quand le dernier date de plus de 7 jours.
alter table restaurant add column if not exists inventaire_le timestamptz;

create table if not exists inventaire (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurant(id) on delete cascade,
  fait_le       timestamptz not null default now(),
  par           text,
  vins          int not null default 0,   -- vins comptés
  changes       int not null default 0    -- vins dont le stock a changé
);
create index if not exists inventaire_restaurant on inventaire (restaurant_id, fait_le desc);

create table if not exists inventaire_ligne (
  inventaire_id uuid not null references inventaire(id) on delete cascade,
  vin_id        text references vin_carte(id) on delete set null,
  avant         int not null,
  apres         int not null
);
create index if not exists inventaire_ligne_inventaire on inventaire_ligne (inventaire_id);

alter table inventaire enable row level security;
alter table inventaire_ligne enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on inventaire, inventaire_ligne from anon, authenticated;
  end if;
end $$;
