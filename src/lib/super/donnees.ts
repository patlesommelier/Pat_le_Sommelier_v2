import 'server-only';
/**
 * Lectures de l'espace super-admin : la cuisine interne de Pat (rankings, versions, publications).
 * Réservé aux pages de /admin/super, toutes protégées par exigerAdmin() : jamais appelé pour un compte restaurant.
 */
import { requete } from '../db';

// ───────── Restaurants ─────────
export async function indicateurs() {
  const [r] = await requete<{ restaurants: number; producteurs: number; principes: string | null; brouillon: string | null; regles: string | null; regles_brouillon: string | null }>(
    `select (select count(*)::int from restaurant) as restaurants,
            (select count(*)::int from producteur where statut = 'propose') as producteurs,
            (select code from principes_version where statut = 'en_service') as principes,
            (select code from principes_version where statut = 'brouillon') as brouillon,
            (select code from regles_version where statut = 'en_service') as regles,
            (select code from regles_version where statut = 'brouillon') as regles_brouillon`);
  return r;
}

export interface RestaurantSuper {
  id: string; nom: string; couleur: string; statut: string; ville: string | null; langues: string[];
  plats: number; vins: number; accords: number; a_relire: number; producteurs: number; acces: number; ajustements: number;
}
export async function restaurantsSuper() {
  return requete<RestaurantSuper>(
    `select r.id, r.nom, r.couleur, r.statut, r.ville, r.langues,
            (select count(*)::int from plat p where p.restaurant_id = r.id and p.actif) as plats,
            (select count(*)::int from vin_carte v where v.restaurant_id = r.id and v.disponible) as vins,
            (select count(*)::int from accord a where a.restaurant_id = r.id) as accords,
            (select count(*)::int from accord a where a.restaurant_id = r.id and a.statut = 'propose') as a_relire,
            (select count(distinct v.producteur_id)::int from vin_carte v join producteur p on p.id = v.producteur_id
              where v.restaurant_id = r.id and p.statut = 'propose') as producteurs,
            (select count(*)::int from acces_restaurant x where x.restaurant_id = r.id) as acces,
            (select count(*)::int from jsonb_object_keys(r.reglages_selection)) as ajustements
       from restaurant r order by r.nom`);
}

// ───────── Producteurs à valider ─────────
export async function producteursAValider() {
  return requete<{ id: string; nom: string; region: string | null; pays: string | null; ranking_suggere: number | null; vins: number; restaurants: string | null }>(
    `select p.id, p.nom, p.region, p.pays, p.ranking_suggere,
            count(v.id)::int as vins, string_agg(distinct r.nom, ', ') as restaurants
       from producteur p left join vin_carte v on v.producteur_id = p.id left join restaurant r on r.id = v.restaurant_id
      where p.statut = 'propose' group by p.id order by count(v.id) desc, p.region nulls last, p.nom`);
}

export interface FicheProducteur {
  id: string; nom: string; pays: string | null; region: string | null; sous_region: string | null; localisation: string | null;
  statut: string; statut_production: string; gamme_prix: string | null; couleurs: string[]; cepages_rois: string[]; appellations_texte: string[];
  ranking_pat: number | null; ranking_suggere: number | null; notes_objectives: string | null; avis_pat: string | null; a_verifier: string | null;
  source: string | null; valide_par: string | null; valide_le: string | null; motif_rejet: string | null;
}
export async function ficheProducteur(id: string) {
  const [p] = await requete<FicheProducteur>(
    `select id, nom, pays, region, sous_region, localisation, statut::text, statut_production::text, gamme_prix::text, couleurs, cepages_rois,
            appellations_texte, ranking_pat, ranking_suggere, notes_objectives, avis_pat, a_verifier, source, valide_par, valide_le, motif_rejet
       from producteur where id = $1`, [id]);
  if (!p) return null;
  const [vins, cuvees, terroirs] = await Promise.all([
    // Vins repérés sur les cartes, avec leur terroir et leur ranking (par cuvée).
    requete<{ id: string; libelle: string; millesime: string | null; couleur: string; restaurant: string; restaurant_id: string; terroir: string | null;
      terroir_id: string | null; ranking_producteur: number | null; ranking_terroir: number | null; prix: number | null }>(
      `select v.id, v.libelle, v.millesime, v.couleur::text, r.nom as restaurant, r.id as restaurant_id, t.nom as terroir, t.id as terroir_id,
              v.ranking_producteur, v.ranking_terroir, v.prix::float as prix
         from vin_carte v join restaurant r on r.id = v.restaurant_id left join terroir t on t.id = v.appellation_id
        where v.producteur_id = $1 order by r.nom, v.ordre`, [id]),
    // Cuvées connues de la base de Pat.
    requete<{ id: string; nom: string; couleur: string | null; appellation: string | null; cepages: string | null }>(
      `select c.id, c.nom, c.couleur::text, t.nom as appellation, c.cepages from cuvee c left join terroir t on t.id = c.appellation_id
        where c.producteur_id = $1 order by c.nom`, [id]),
    requete<{ id: string; nom: string; region: string | null; ranking_pat: number | null; statut: string }>(
      `select distinct t.id, t.nom, t.region, t.ranking_pat, t.statut::text from vin_carte v join terroir t on t.id = v.appellation_id
        where v.producteur_id = $1 order by t.nom`, [id]),
  ]);
  return { ...p, vins, cuvees, terroirs };
}

// ───────── Base et rankings ─────────
export async function rechercherProducteurs({ texte = '', pays = '', restaurant = '', page = 0 }: { texte?: string; pays?: string; restaurant?: string; page?: number }) {
  const lignes = await requete<{ id: string; nom: string; pays: string | null; region: string | null; ranking_pat: number | null; statut: string; cuvees: number; vins_carte: number; total: number }>(
    `select p.id, p.nom, p.pays, p.region, p.ranking_pat, p.statut::text,
            (select count(*)::int from cuvee c where c.producteur_id = p.id) as cuvees,
            (select count(*)::int from vin_carte v where v.producteur_id = p.id) as vins_carte,
            count(*) over ()::int as total
       from producteur p
      where ($1 = '' or translate(lower(p.nom), 'àâäáéèêëíîïóôöúùûüç', 'aaaaeeeeiiiooouuuuc') like '%' || translate(lower($1), 'àâäáéèêëíîïóôöúùûüç', 'aaaaeeeeiiiooouuuuc') || '%'
             or lower(coalesce(p.region, '')) like '%' || lower($1) || '%')
        and ($2 = '' or p.pays = $2)
        and ($3 = '' or exists (select 1 from vin_carte v where v.producteur_id = p.id and v.restaurant_id = $3))
      order by (select count(*) from vin_carte v where v.producteur_id = p.id) desc, p.nom
      limit 50 offset $4`, [texte.trim(), pays, restaurant, page * 50]);
  return { lignes, total: lignes[0]?.total ?? 0 };
}

export async function paysProducteurs() {
  return (await requete<{ pays: string }>(`select distinct pays from producteur where pays is not null order by pays`)).map((p) => p.pays);
}

export async function rechercherTerroirs({ texte = '', pays = '', page = 0 }: { texte?: string; pays?: string; page?: number }) {
  const lignes = await requete<{ id: string; nom: string; pays: string | null; region: string | null; niveau: string; ranking_pat: number | null; vins_carte: number; total: number }>(
    `select t.id, t.nom, t.pays, t.region, t.niveau, t.ranking_pat,
            (select count(*)::int from vin_carte v where v.appellation_id = t.id) as vins_carte, count(*) over ()::int as total
       from terroir t
      where ($1 = '' or lower(t.nom) like '%' || lower($1) || '%' or lower(coalesce(t.region, '')) like '%' || lower($1) || '%')
        and ($2 = '' or t.pays = $2)
      order by (select count(*) from vin_carte v where v.appellation_id = t.id) desc, t.nom
      limit 50 offset $3`, [texte.trim(), pays, page * 50]);
  return { lignes, total: lignes[0]?.total ?? 0 };
}

/** Détail des producteurs affichés : vins des cartes (avec terroir et ranking du terroir) et cuvées de la base. */
export async function detailsProducteurs(ids: string[]) {
  if (!ids.length) return { vins: new Map(), cuvees: new Map() };
  const [vins, cuvees] = await Promise.all([
    requete<{ producteur_id: string; id: string; libelle: string; millesime: string | null; couleur: string; restaurant: string; terroir: string | null;
      ranking_terroir: number | null; ranking_producteur: number | null; prix: number | null }>(
      `select v.producteur_id, v.id, v.libelle, v.millesime, v.couleur::text, r.nom as restaurant, t.nom as terroir, coalesce(t.ranking_pat, v.ranking_terroir) as ranking_terroir,
              v.ranking_producteur, v.prix::float as prix
         from vin_carte v join restaurant r on r.id = v.restaurant_id left join terroir t on t.id = v.appellation_id
        where v.producteur_id = any($1) order by r.nom, v.ordre`, [ids]),
    requete<{ producteur_id: string; id: string; nom: string; couleur: string | null; appellation: string | null; ranking_terroir: number | null }>(
      `select c.producteur_id, c.id, c.nom, c.couleur::text, t.nom as appellation, t.ranking_pat as ranking_terroir
         from cuvee c left join terroir t on t.id = c.appellation_id where c.producteur_id = any($1) order by c.nom`, [ids]),
  ]);
  const grouper = <T extends { producteur_id: string }>(l: T[]) => l.reduce((m, x) => m.set(x.producteur_id, [...(m.get(x.producteur_id) ?? []), x]), new Map<string, T[]>());
  return { vins: grouper(vins), cuvees: grouper(cuvees) };
}

export async function restaurantsListe() {
  return requete<{ id: string; nom: string }>('select id, nom from restaurant order by nom');
}
