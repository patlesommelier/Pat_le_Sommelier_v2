import 'server-only';
import { requete } from './db';
import type { PlatCtx, PrincipeCtx, RegleCtx, VinCtx } from './pat-cerveau';

/** Charge tout ce dont Pat a besoin pour répondre dans un restaurant. */
export async function chargerContexte(restaurantId: string) {
  const [principes, regles, carte, plats] = await Promise.all([
    requete<PrincipeCtx>(`select id, numero, titre, regle, role, statut from principe where statut <> 'retire'`),
    requete<RegleCtx>(
      `select type, portee, cible, valeur, texte from regle_sommelier
        where restaurant_id = $1 and actif and (date_debut is null or date_debut <= current_date) and (date_fin is null or date_fin >= current_date)
        order by priorite`,
      [restaurantId],
    ),
    requete<VinCtx>(
      `select v.id, v.couleur, v.libelle, coalesce(p.nom, v.producteur_texte) as producteur, v.millesime, v.format,
              v.prix::float as prix, v.prix_verre::float as prix_verre, v.cepages, v.profil_degustation as profil,
              p.ranking_pat as ranking_producteur, p.avis_pat, v.coup_de_coeur
         from vin_carte v left join producteur p on p.id = v.producteur_id
        where v.restaurant_id = $1 and v.disponible order by v.ordre`,
      [restaurantId],
    ),
    requete<PlatCtx>(
      `select pl.id, pl.nom, pl.categorie, coalesce(pa.ancrages, '{}') as ancrages, pa.profil, coalesce(pa.couleurs_ok::text[], '{}') as couleurs_ok,
              coalesce(pa.cepages_conseilles, '{}') as cepages_conseilles,
              pa.a_eviter, pa.temperature_service, coalesce(pa.principes, '{}') as principes, pa.plafond
         from plat pl left join profil_accord pa on pa.plat_id = pl.id
        where pl.restaurant_id = $1 and pl.actif order by pl.ordre`,
      [restaurantId],
    ),
  ]);
  return { principes, regles, carte, plats };
}
