-- Pat le sommelier — migration 0007 : la base n'est lisible que par le serveur.
-- Les rankings de Pat (vin_carte.ranking_producteur / ranking_terroir, producteur.ranking_pat, terroir.ranking_pat),
-- le score et les autres données internes ne doivent jamais être lisibles avec la clé publique de Supabase,
-- ni par un compte restaurant connecté. L'app lit tout côté serveur (DATABASE_URL) ; Supabase n'est utilisé
-- dans le navigateur que pour la connexion (Auth) et le stockage des photos (Storage, schéma « storage »).
-- On retire donc tout accès direct aux tables du schéma public pour les rôles anon et authenticated,
-- y compris pour les tables créées plus tard.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
  end if;
end $$;
