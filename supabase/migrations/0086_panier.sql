-- Panier de commande d'un restaurant (page Vins) : des bouteilles de chaque vin, ajoutées ligne par ligne,
-- commandées ensuite en une fois (une commande par distributeur, une seule pour les distributeurs Quid Vinum).
create table if not exists panier (
  restaurant_id text not null references restaurant(id) on delete cascade,
  vin_id        text not null references vin_carte(id) on delete cascade,
  quantite      int not null check (quantite > 0),
  ajoute_le     timestamptz not null default now(),
  primary key (restaurant_id, vin_id)
);
alter table panier enable row level security;
