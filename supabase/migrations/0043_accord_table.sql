-- Vins choisis par Pat pour plusieurs plats à la même table (principes « plusieurs plats ») : gardés pour ne pas refaire l'appel.
-- La clé change dès que les plats, les vins candidats, leurs notes ou les principes changent.
create table if not exists accord_table (
  restaurant_id text not null references restaurant(id) on delete cascade,
  cle text not null,
  resultat jsonb not null,
  cree_le timestamptz not null default now(),
  primary key (restaurant_id, cle)
);
alter table accord_table enable row level security;
