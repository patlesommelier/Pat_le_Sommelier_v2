-- Relecture des prix des plats depuis le menu, lancée par le super-admin pour un restaurant déjà inscrit.
-- Les photos du menu sont gardées le temps de la lecture (fonction d'arrière-plan), puis effacées.
create table if not exists relecture_prix (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  text not null references restaurant(id) on delete cascade,
  statut         text not null default 'en_attente',   -- en_attente, en_cours, ok, erreur
  message        text,
  demande_par    text,
  cree_le        timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);
create index if not exists relecture_prix_idx on relecture_prix (restaurant_id, cree_le desc);

create table if not exists relecture_prix_fichier (
  relecture_id  uuid not null references relecture_prix(id) on delete cascade,
  nom           text not null,
  media_type    text not null,
  octets        bytea not null,
  cree_le       timestamptz not null default now()
);
create index if not exists relecture_prix_fichier_idx on relecture_prix_fichier (relecture_id);

alter table relecture_prix enable row level security;
alter table relecture_prix_fichier enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on relecture_prix, relecture_prix_fichier from anon, authenticated;
  end if;
end $$;
