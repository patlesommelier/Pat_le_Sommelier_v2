import 'server-only';
import { requete } from './db';
import type { PlatCtx, PrincipeCtx, RegleCtx, VinCtx } from './pat-cerveau';

/** Charge tout ce dont Pat a besoin pour répondre dans un restaurant. */
export async function chargerContexte(restaurantId: string) {
  const [principes, regles, carte, plats] = await Promise.all([
    requete<PrincipeCtx>(`select id, numero, titre, regle, role, statut from principe where statut <> 'retire'`),
    requete<RegleCtx>(
      // Règles de sélection (regles_selection.xlsx : Plat seul, Plusieurs plats, Hors menu, Tour 2 et verre…)
      // puis consignes ponctuelles du sommelier.
      `select * from (
         select 1 as bloc, onglet as type, 'tout' as portee, null as cible, null as valeur,
                ordre || '. ' || nom || ' : ' || enonce as texte, rang as tri, onglet as groupe
           from regle_selection where restaurant_id = $1
         union all
         select 2, type::text, portee::text, cible, valeur, texte, priorite, ''
           from regle_sommelier
          where restaurant_id = $1 and actif and (date_debut is null or date_debut <= current_date) and (date_fin is null or date_fin >= current_date)
       ) r order by bloc, groupe, tri`,
      [restaurantId],
    ),
    requete<VinCtx>(
      `select v.id, v.couleur, v.libelle, case when v.modifie_bo is not null and v.producteur_texte is not null then v.producteur_texte else coalesce(p.nom, v.producteur_texte) end as producteur, v.millesime, v.format,
              v.prix::float as prix, v.prix_verre::float as prix_verre, v.cepages, v.profil_degustation as profil,
              coalesce(v.ranking_producteur, p.ranking_pat) as ranking_producteur, p.avis_pat, v.coup_de_coeur, v.descriptif
         from vin_carte v left join producteur p on p.id = v.producteur_id
        where v.restaurant_id = $1 and v.disponible order by v.ordre`,
      [restaurantId],
    ),
    requete<PlatCtx>(
      `select pl.id, pl.nom, pl.categorie, pl.description_cuisine, coalesce(pa.ancrages, '{}') as ancrages, pa.profil, coalesce(pa.couleurs_ok::text[], '{}') as couleurs_ok,
              coalesce(pa.cepages_conseilles, '{}') as cepages_conseilles,
              pa.a_eviter, pa.temperature_service, coalesce(pa.principes, '{}') as principes, pa.plafond
         from plat pl left join profil_accord pa on pa.plat_id = pl.id
        where pl.restaurant_id = $1 and pl.actif and exists (select 1 from accord a where a.plat_id = pl.id) order by pl.ordre`,
      [restaurantId],
    ),
  ]);
  return { principes, regles, carte, plats };
}
