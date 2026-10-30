-- Comptes (restaurants, Pat et App client) gérés par Pat lui-même, à la place de Supabase Auth.
-- Les anciens comptes Supabase ne sont pas repris : les accès des restaurants (acces_restaurant) se retrouvent par l'adresse
-- e-mail, avec « Mot de passe oublié » ou un accès recréé. Les profils de l'App client sont effacés (décision de Pat).

create table if not exists compte (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  mot_de_passe        text,            -- scrypt$sel$empreinte ; null tant que la personne ne l'a pas choisi (invitation)
  cree_le             timestamptz not null default now(),
  derniere_connexion  timestamptz
);
create unique index if not exists compte_email_idx on compte (lower(email));

-- Sessions ouvertes (cookie du navigateur) : seule l'empreinte SHA-256 du jeton est gardée.
create table if not exists session_compte (
  jeton      text primary key,
  compte_id  uuid not null references compte(id) on delete cascade,
  expire_le  timestamptz not null,
  cree_le    timestamptz not null default now()
);
create index if not exists session_compte_compte_idx on session_compte (compte_id);

-- Liens envoyés par e-mail (invitation, mot de passe oublié) : valables jusqu'à leur date, effacés dès que le mot de passe change.
create table if not exists lien_compte (
  jeton      text primary key,
  compte_id  uuid not null references compte(id) on delete cascade,
  expire_le  timestamptz not null,
  cree_le    timestamptz not null default now()
);
create index if not exists lien_compte_compte_idx on lien_compte (compte_id);

delete from utilisateur_app;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on compte, session_compte, lien_compte from anon, authenticated;
  end if;
end $$;
