-- Étiquettes des vins sans producteur reconnu (donc sans cuvée) : gardées dans la base de Pat sous le nom exact
-- du vin et sa couleur, et reprises par une autre carte (ou la même, recréée) qui porte ce vin.
create table if not exists etiquette_libelle (
  cle               text primary key,           -- nom du vin normalisé | couleur
  libelle           text not null,
  couleur           text not null,
  etiquette_url     text not null,
  etiquette_source  text,
  vin_id            text references vin_carte(id) on delete set null,
  maj_le            timestamptz not null default now()
);
alter table etiquette_libelle enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on etiquette_libelle from anon, authenticated;
  end if;
end $$;
