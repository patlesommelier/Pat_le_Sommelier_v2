-- Restaurant de démonstration « Chez Pat » (démos et site web), composé à partir de Lola :
-- 4 entrées, 8 plats, et les vins blancs et rouges complets (étiquette et présentation) qui s'accordent le mieux
-- avec ces plats, avec leurs accords déjà validés. Rien n'est créé si Lola n'existe pas ou si « Chez Pat » existe déjà.
do $$
begin
  if not exists (select 1 from restaurant where id = 'lola') or exists (select 1 from restaurant where id = 'chez-pat') then
    return;
  end if;

  insert into restaurant (id, nom, couleur, couleur_claire, accroche, statut, origine, cree_par)
  values ('chez-pat', 'Chez Pat', '#610420', '#F4EDEF', 'Bienvenue chez Pat,|nous vous aidons à choisir votre vin', 'en_service', 'super_admin', 'démo');

  -- Plats choisis (ceux qui existent et sont actifs chez Lola), dans l'ordre de la carte.
  create temp table demo_plat on commit drop as
  select p.id as source, 'chez-pat-' || substr(p.id, 6) as id, c.ordre
    from (values ('lola-carpaccio-de-boeuf', 1), ('lola-emince-de-bar', 2), ('lola-croquettes-crevettes', 3), ('lola-foie-gras', 4),
                 ('lola-bar-roti', 5), ('lola-cabillaud', 6), ('lola-solettes-meuniere', 7), ('lola-risotto-champignons', 8),
                 ('lola-volaille-morilles', 9), ('lola-ris-de-veau', 10), ('lola-filet-pur-poivre-vert', 11), ('lola-tartare-de-boeuf', 12)) c(id, ordre)
    join plat p on p.id = c.id and p.restaurant_id = 'lola' and p.actif;

  -- Vins : blancs et rouges disponibles, avec étiquette et présentation ; les 6 de chaque couleur
  -- qui ont le plus de beaux accords (4 ou 5) avec les plats choisis.
  create temp table demo_vin on commit drop as
  select source, case when source ~ '^L-' then 'P-' || substr(source, 3) else 'chez-pat-' || source end as id
    from (select v.id as source, row_number() over (partition by v.couleur
                   order by count(a.*) filter (where a.note >= 4) desc, count(a.*) desc, v.ordre) as n
            from vin_carte v
            left join accord a on a.vin_id = v.id and a.statut = 'valide' and a.plat_id in (select source from demo_plat)
           where v.restaurant_id = 'lola' and v.disponible and v.couleur::text in ('blanc', 'rouge')
             and v.etiquette_url is not null and coalesce(v.presentation, v.presentation_carte) is not null
           group by v.id) t
   where n <= 6;

  insert into plat (id, restaurant_id, nom, nom_court, categorie, prix, prix_variantes, specialite_maison, actif, ordre,
                    description_cuisine, sauce_servie_a_part)
  select d.id, 'chez-pat', p.nom, p.nom_court, p.categorie, p.prix, p.prix_variantes, p.specialite_maison, true, d.ordre,
         p.description_cuisine, p.sauce_servie_a_part
    from demo_plat d join plat p on p.id = d.source;

  insert into profil_accord (plat_id, ancrages, profil, couleurs_ok, cepages_conseilles, a_eviter, temperature_service,
                             principes, plafond, version_principes, texte_complet)
  select d.id, pa.ancrages, pa.profil, pa.couleurs_ok, pa.cepages_conseilles, pa.a_eviter, pa.temperature_service,
         pa.principes, pa.plafond, pa.version_principes, pa.texte_complet
    from demo_plat d join profil_accord pa on pa.plat_id = d.source;

  insert into vin_carte (id, restaurant_id, couleur, section, libelle, producteur_id, producteur_texte, cuvee_id, appellation_id,
                         vin_texte, millesime, format, prix, prix_verre, cepages, profil_degustation, descriptif, presentation,
                         resume_court, etiquette_url, etiquette_source, etiquette_statut, coup_de_coeur, disponible, ordre,
                         ranking_producteur, ranking_terroir, pays, presentation_carte, presentation_carte_perso)
  select d.id, 'chez-pat', v.couleur, v.section, v.libelle, v.producteur_id, v.producteur_texte, v.cuvee_id, v.appellation_id,
         v.vin_texte, v.millesime, v.format, v.prix, v.prix_verre, v.cepages, v.profil_degustation, v.descriptif, v.presentation,
         v.resume_court, v.etiquette_url, v.etiquette_source, v.etiquette_statut, v.coup_de_coeur, true, v.ordre,
         v.ranking_producteur, v.ranking_terroir, v.pays, v.presentation_carte, v.presentation_carte_perso
    from demo_vin d join vin_carte v on v.id = d.source;

  insert into accord (restaurant_id, plat_id, vin_id, note, rang, explication, explication_longue, principes, service, origine,
                      statut, commentaire_sommelier, calcule_le, valide_le, modifie_par, limite, explication_generee_le, regenere_le)
  select 'chez-pat', dp.id, dv.id, a.note, a.rang, a.explication, a.explication_longue, a.principes, a.service, a.origine,
         a.statut, a.commentaire_sommelier, a.calcule_le, a.valide_le, a.modifie_par, a.limite, a.explication_generee_le, a.regenere_le
    from accord a
    join demo_plat dp on dp.source = a.plat_id
    join demo_vin dv on dv.source = a.vin_id
   where a.statut = 'valide';

  -- Un plat sans accord n'apparaîtrait pas dans l'app : il est retiré de la démo.
  delete from plat p where p.restaurant_id = 'chez-pat' and not exists (select 1 from accord a where a.plat_id = p.id);
end $$;
