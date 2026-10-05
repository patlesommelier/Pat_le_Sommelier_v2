-- Pat le sommelier — migration 0014 : espace super-admin.
-- Restaurants : statut, ville, langues, date de création (tableau « Restaurants » et formulaire « Créer un restaurant »).

alter table restaurant add column if not exists statut text not null default 'en_service'
  check (statut in ('mise_en_place', 'en_service', 'suspendu'));
alter table restaurant add column if not exists ville text;
alter table restaurant add column if not exists langues text[] not null default '{fr}';
alter table restaurant add column if not exists cree_le timestamptz not null default now();
alter table restaurant add column if not exists cree_par text;

-- Import d'une version de principes en deux temps : le fichier est vérifié (erreurs, avertissements, différences),
-- puis Pat confirme la création du brouillon sans le renvoyer. Les imports de plus d'un jour sont effacés.
create table if not exists principes_import (
  id           uuid primary key default gen_random_uuid(),
  nom_fichier  text not null,
  contenu      bytea not null,
  resultat     jsonb not null,                   -- { erreurs, avertissements, differences }
  par          text,
  cree_le      timestamptz not null default now()
);
alter table principes_import enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on principes_import from anon, authenticated;
  end if;
end $$;
