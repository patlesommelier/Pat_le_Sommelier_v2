-- Pat le sommelier — migration 0004 : les principes de Pat sont confidentiels.
-- L'app lit la base côté serveur uniquement ; rien ne doit être lisible avec la clé publique (anon) de Supabase.

drop policy if exists lecture on principe;

-- Les accords restent lisibles (carte client), mais sans la colonne « principes ».
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke select on accord from anon, authenticated;
    grant select (id, restaurant_id, plat_id, vin_id, note, rang, explication, explication_longue, service,
                  origine, statut, calcule_le, valide_le) on accord to anon, authenticated;
    revoke all on principe, question_pat, profil_accord, regle_selection, regle_sommelier from anon, authenticated;
  end if;
end $$;
