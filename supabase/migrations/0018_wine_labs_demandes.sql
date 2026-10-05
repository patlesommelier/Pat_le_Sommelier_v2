-- Demandes d'étiquettes à Wine Labs (POST /wine_labels), envoyées par une fonction d'arrière-plan.
-- File : vin_carte.etiquette_statut = 'a_demander' (une seule demande par cuvée, voir src/lib/etiquettes/wine-labs.ts).
alter table vin_carte drop constraint if exists vin_carte_etiquette_statut_check;
alter table vin_carte add constraint vin_carte_etiquette_statut_check
  check (etiquette_statut in ('a_demander', 'demandee', 'trouvee', 'introuvable', 'echec'));

alter table demande_etiquette add column if not exists cuvee_id text references cuvee(id) on delete set null;
alter table demande_etiquette add column if not exists asset_url text; -- lien signé de Wine Labs (valable 7 jours) ; image_url = notre copie

-- Réglages techniques côté serveur (jamais lus par le navigateur) : secret du webhook Wine Labs enregistré depuis le super-admin.
create table if not exists reglage_serveur (
  cle      text primary key,
  valeur   text not null,
  maj_le   timestamptz not null default now()
);
alter table reglage_serveur enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on reglage_serveur from anon, authenticated;
  end if;
end $$;
