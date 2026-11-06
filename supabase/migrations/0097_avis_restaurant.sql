-- Avis de Quid Vinum à un restaurant, affichés en haut de son espace jusqu'à ce qu'il les ferme
-- (ex. « Licata est désormais distributeur Quid Vinum : vos commandes passent par Quid Vinum »).
create table if not exists avis_restaurant (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurant(id) on delete cascade,
  titre         text not null,
  texte         text not null,
  lien          text,
  cree_le       timestamptz not null default now(),
  lu_le         timestamptz
);
create index if not exists avis_restaurant_a_lire on avis_restaurant (restaurant_id) where lu_le is null;
alter table avis_restaurant enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on avis_restaurant from anon, authenticated;
  end if;
end $$;
