-- Prix QV d'un distributeur : lus dans sa liste (deux prix, ou un seul prix qui est déjà le prix QV),
-- ou calculés : prix publié moins la remise QV (%).
alter table distributeur add column if not exists calcul_qv text not null default 'liste';
do $$ begin
  alter table distributeur add constraint distributeur_calcul_qv check (calcul_qv in ('liste', 'remise'));
exception when duplicate_object then null; end $$;
