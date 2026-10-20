-- App consommateur (/pat) : les accords mets-vins de référence de Pat et les comptes des utilisateurs de l'App.
-- Les comptes eux-mêmes sont dans Supabase Auth (comme ceux des restaurants) ; utilisateur_app garde le profil.

create table if not exists accord_reference (
  id                        text primary key,
  nom                       text not null,
  famille                   text,
  sous_famille              text,
  variantes                 text,
  axes_accord               text,
  intensite                 smallint,
  categorie_vin_principale  text,
  vins_recommandes          text,
  producteurs_phares        text,
  alternative_accessible    text,
  justification_charnelle   text,
  notes_pratiques           text,
  mes_notes                 text,
  ranking_pat               smallint,
  tags                      text[] not null default '{}',
  source                    text,
  a_verifier                text,
  commentaire_delmas        text,
  axe_diversite_2           jsonb,
  axe_diversite_3           jsonb,
  actif                     boolean not null default true,
  maj_le                    timestamptz not null default now()
);

create table if not exists utilisateur_app (
  user_id              uuid primary key,
  email                text not null,
  prenom               text,
  fournisseur          text not null default 'email', -- email, google, apple
  cree_le              timestamptz not null default now(),
  derniere_connexion   timestamptz not null default now()
);
create index if not exists utilisateur_app_email_idx on utilisateur_app (lower(email));

alter table accord_reference enable row level security;
alter table utilisateur_app enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on accord_reference from anon, authenticated;
    revoke all on utilisateur_app from anon, authenticated;
  end if;
end $$;
