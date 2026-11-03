-- « Trouver un vin » (espace restaurant, sous Ma cave) : la demande du restaurant (texte libre, plat, budget, couleur)
-- et les propositions de Pat dans les catalogues des distributeurs Quid Vinum (2 vins par distributeur, avec leur explication).
create table if not exists recherche_vin (
  id            text primary key,
  restaurant_id text not null references restaurant(id) on delete cascade,
  demande       text not null,
  plat_id       text references plat(id) on delete set null,
  budget        numeric(8,2),
  couleur       text,
  statut        text not null default 'en_cours' check (statut in ('en_cours', 'terminee', 'echec')),
  message       text,
  resultat      jsonb,
  cree_par      text,
  cree_le       timestamptz not null default now()
);
create index if not exists recherche_vin_restaurant on recherche_vin (restaurant_id, cree_le desc);
alter table recherche_vin enable row level security;
