-- Facture d'une commande Quid Vinum (PDF), jointe par le super-admin à tout moment et lue par le restaurant.
-- Gardée dans la base (pas dans le stockage public des images) : elle n'est servie qu'au restaurant et au super-admin.
create table if not exists facture_commande (
  commande_id text primary key references commande(id) on delete cascade,
  nom         text not null,
  octets      bytea not null,
  taille      int not null,
  depose_par  text,
  depose_le   timestamptz not null default now()
);
alter table facture_commande enable row level security;
