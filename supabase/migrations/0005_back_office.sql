-- Pat le sommelier — migration 0005 : back-office des restaurants

-- Réglages des règles de sélection propres au restaurant (vide = règles de Pat V7)
alter table restaurant add column if not exists reglages_selection jsonb not null default '{}';
-- Logo foncé, pour une couleur d'app claire
alter table restaurant add column if not exists logo_fonce_url text;

-- Lignes modifiées dans le back-office : l'import des fichiers ne les écrase plus.
alter table plat add column if not exists modifie_bo timestamptz;
alter table vin_carte add column if not exists modifie_bo timestamptz;
alter table restaurant add column if not exists modifie_bo timestamptz;

-- Comptes du back-office (Supabase Auth) reliés à un restaurant.
-- Les administrateurs (Pat) sont désignés par la variable PAT_ADMIN_EMAILS et voient tous les restaurants.
create table if not exists acces_restaurant (
  user_id        uuid not null,
  email          text not null,
  restaurant_id  text not null references restaurant(id) on delete cascade,
  cree_le        timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);
create index if not exists acces_restaurant_email_idx on acces_restaurant (lower(email));

-- Trace des modifications d'accords faites par le sommelier
alter table accord add column if not exists modifie_par text;

alter table acces_restaurant enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on acces_restaurant from anon, authenticated;
  end if;
end $$;
