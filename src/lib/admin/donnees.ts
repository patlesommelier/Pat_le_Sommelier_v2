import 'server-only';
import { requete } from '../db';
import { REGLAGES_PAT, reglagesComplets, type Reglages } from '../selection';

export interface RestaurantBO {
  id: string; nom: string; couleur: string; couleur_claire: string; logo_url: string | null; logo_fonce_url: string | null;
  accroche: string | null; reglages_selection: Record<string, unknown>; modifie_bo: string | null;
}

export async function getRestaurantBO(id: string) {
  const [r] = await requete<RestaurantBO>(
    `select id, nom, couleur, couleur_claire, logo_url, logo_fonce_url, accroche, reglages_selection, modifie_bo
       from restaurant where id = $1`, [id]);
  return r ?? null;
}

export async function listeRestaurants() {
  return requete<{ id: string; nom: string; couleur: string; plats: number; vins: number }>(
    `select r.id, r.nom, r.couleur,
            (select count(*)::int from plat p where p.restaurant_id = r.id) as plats,
            (select count(*)::int from vin_carte v where v.restaurant_id = r.id) as vins
       from restaurant r order by r.nom`);
}

export interface Resume {
  plats: number; plats_inactifs: number; vins: number; vins_etiquette: number; vins_producteur: number;
  vins_indisponibles: number; nouveaux_producteurs: number; accords: number; accords_valides: number;
  accords_proposes: number; plats_avec_accords: number; acces: number;
}

export async function getResume(id: string): Promise<Resume> {
  const [r] = await requete<Resume>(
    `select
       (select count(*)::int from plat where restaurant_id = $1 and actif) as plats,
       (select count(*)::int from plat where restaurant_id = $1 and not actif) as plats_inactifs,
       (select count(*)::int from vin_carte where restaurant_id = $1) as vins,
       (select count(*)::int from vin_carte where restaurant_id = $1 and etiquette_url is not null) as vins_etiquette,
       (select count(*)::int from vin_carte where restaurant_id = $1 and producteur_id is not null) as vins_producteur,
       (select count(*)::int from vin_carte where restaurant_id = $1 and not disponible) as vins_indisponibles,
       (select count(distinct p.id)::int from producteur p join vin_carte v on v.producteur_id = p.id
         where v.restaurant_id = $1 and p.statut = 'propose') as nouveaux_producteurs,
       (select count(*)::int from accord where restaurant_id = $1) as accords,
       (select count(*)::int from accord where restaurant_id = $1 and statut = 'valide') as accords_valides,
       (select count(*)::int from accord where restaurant_id = $1 and statut = 'propose') as accords_proposes,
       (select count(distinct plat_id)::int from accord where restaurant_id = $1) as plats_avec_accords,
       (select count(*)::int from acces_restaurant where restaurant_id = $1) as acces`,
    [id]);
  return r;
}

/** Réglages modifiés par rapport aux règles de Pat en service (`base`). */
export function reglagesModifies(r: RestaurantBO | null, base: Reglages = REGLAGES_PAT): (keyof Reglages)[] {
  const R = reglagesComplets(r?.reglages_selection, base);
  return (Object.keys(base) as (keyof Reglages)[]).filter((k) => R[k] !== base[k]);
}

// ───────── Menu ─────────
export interface PlatBO {
  id: string; nom: string; nom_court: string | null; categorie: string; prix: number | null; prix_variantes: string | null;
  actif: boolean; ordre: number; modifie_bo: string | null;
  description_cuisine: string | null; description_apres_accords: boolean;
}
export async function getPlatsBO(restaurantId: string) {
  return requete<PlatBO>(
    `select pl.id, pl.nom, pl.nom_court, pl.categorie::text, pl.prix, pl.prix_variantes, pl.actif, pl.ordre, pl.modifie_bo, pl.description_cuisine,
            coalesce(pl.description_modifiee_le > (select max(a.calcule_le) from accord a where a.plat_id = pl.id and a.origine = 'pat'), false) as description_apres_accords
       from plat pl where pl.restaurant_id = $1 order by pl.ordre`, [restaurantId]);
}
export async function getProfil(platId: string) {
  const [p] = await requete<{ ancrages: string[]; profil: string | null; a_eviter: string | null; temperature_service: string | null }>(
    'select ancrages, profil, a_eviter, temperature_service from profil_accord where plat_id = $1', [platId]);
  return p ?? null;
}

// ───────── Carte ─────────
export interface VinBO {
  id: string; couleur: string; section: string | null; libelle: string; producteur_id: string | null; producteur_texte: string | null;
  producteur_nom: string | null; producteur_statut: string | null;
  /** Ce que le restaurant voit du producteur : déjà dans la base de Pat, ou nouveau (proposé). */
  statut_producteur: 'reference' | 'nouveau' | null;
  millesime: string | null; format: string; prix: number | null; prix_verre: number | null; cepages: string | null;
  resume_court: string | null; presentation: string | null; etiquette_url: string | null; etiquette_source: string | null;
  etiquette_statut: string | null; coup_de_coeur: boolean; disponible: boolean; a_verifier: string | null;
  pays: string | null; vin_texte: string | null;
  /** Présentation pour la carte imprimée : générée par Pat, et corrigée par le restaurant (prioritaire). */
  presentation_carte: string | null; presentation_carte_perso: string | null;
  profil_degustation: Record<string, unknown> | null; ordre: number;
}
export async function getVinsBO(restaurantId: string) {
  return requete<VinBO>(
    `select v.id, v.couleur::text, v.section, v.libelle, v.producteur_id, v.producteur_texte, p.nom as producteur_nom,
            p.statut::text as producteur_statut,
            case when p.statut <> 'valide' then 'nouveau' when v.producteur_id is not null then 'reference' end as statut_producteur,
            v.millesime, v.format, v.prix, v.prix_verre,
            v.cepages, v.resume_court, v.presentation, v.etiquette_url, v.etiquette_source, v.etiquette_statut, v.coup_de_coeur,
            v.disponible, v.a_verifier, v.pays, v.vin_texte, v.profil_degustation, v.ordre, v.presentation_carte, v.presentation_carte_perso
       from vin_carte v left join producteur p on p.id = v.producteur_id
      where v.restaurant_id = $1 order by v.ordre`, [restaurantId]);
}

/**
 * Ce qui empêche une note plus haute, par vin, pour un plat (champ « limite » des commentaires générés) : cuisine interne.
 * À n'appeler que pour un administrateur (Pat) ; jamais pour un compte restaurant.
 */
export async function getLimitesInternes(restaurantId: string, platId: string) {
  const r = await requete<{ vin_id: string; limite: string }>(
    'select vin_id, limite from accord where restaurant_id = $1 and plat_id = $2 and limite is not null', [restaurantId, platId]);
  return new Map(r.map((x) => [x.vin_id, x.limite]));
}

/**
 * Rankings de Pat (producteur, terroir) des vins d'un restaurant : cuisine interne.
 * À n'appeler que pour un administrateur (Pat) ; jamais pour un compte restaurant.
 */
export async function getRankingsInternes(restaurantId: string) {
  const r = await requete<{ id: string; ranking_producteur: number | null; ranking_terroir: number | null }>(
    'select id, ranking_producteur, ranking_terroir from vin_carte where restaurant_id = $1', [restaurantId]);
  return new Map(r.map((x) => [x.id, x]));
}

// ───────── Accords ─────────
export interface AccordBO {
  vin_id: string; note: number; statut: string; origine: string; explication: string | null; modifie_par: string | null;
}
export async function getAccordsPlat(restaurantId: string, platId: string) {
  return requete<AccordBO>(
    `select vin_id, note, statut::text, origine::text, explication, modifie_par
       from accord where restaurant_id = $1 and plat_id = $2`, [restaurantId, platId]);
}
export async function getStatsAccordsParPlat(restaurantId: string) {
  return requete<{ plat_id: string; total: number; valides: number }>(
    `select plat_id, count(*)::int as total, count(*) filter (where statut = 'valide')::int as valides
       from accord where restaurant_id = $1 group by plat_id`, [restaurantId]);
}

// ───────── Règles ponctuelles ─────────
export async function getExclusions(restaurantId: string) {
  return requete<{ id: string; cible: string; texte: string; date_fin: string | null }>(
    `select id, cible, texte, to_char(date_fin, 'YYYY-MM-DD') as date_fin from regle_sommelier
      where restaurant_id = $1 and type = 'exclure' and portee = 'vin' and actif order by id`, [restaurantId]);
}

// ───────── Accès ─────────
export async function getAcces(restaurantId: string) {
  return requete<{ user_id: string; email: string; cree_le: string }>(
    `select user_id, email, to_char(cree_le, 'DD/MM/YYYY') as cree_le from acces_restaurant where restaurant_id = $1 order by cree_le`,
    [restaurantId]);
}

// ───────── Producteurs proposés (administrateur) ─────────
export async function getProducteursProposes() {
  return requete<{ id: string; nom: string; region: string | null; pays: string | null; notes_objectives: string | null; a_verifier: string | null; vins: string | null }>(
    `select p.id, p.nom, p.region, p.pays, p.notes_objectives, p.a_verifier,
            string_agg(v.restaurant_id || ' ' || v.id || ' · ' || v.libelle, ' ; ' order by v.id) as vins
       from producteur p left join vin_carte v on v.producteur_id = p.id
      where p.statut = 'propose' group by p.id order by p.region nulls last, p.nom`);
}

// ───────── Producteurs de la base de Pat : suggestions pour relier un vin ─────────
const SANS_ACCENTS = `translate(lower(nom), 'àâäáãéèêëíìîïóòôöõúùûüçñœ', 'aaaaaeeeeiiiiooooouuuucno')`;
const MOTS_VIDES = new Set(['domaine', 'chateau', 'maison', 'cave', 'caves', 'cantina', 'bodegas', 'bodega', 'tenuta', 'weingut', 'clos',
  'des', 'du', 'de', 'la', 'le', 'les', 'et', 'fils', 'freres', 'pere', 'vignerons', 'vignobles', 'non', 'indique', 'carte', 'confirmer', 'probable']);
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe');

export interface ProducteurSuggere { id: string; nom: string; region: string | null; pays: string | null; statut: string }

/** Producteurs de la base de Pat dont le nom ressemble au texte saisi (les plus proches d'abord). */
export async function suggestionsProducteurs(texte: string | null, limite = 5): Promise<ProducteurSuggere[]> {
  const mots = [...new Set(norm(texte ?? '').split(/[^a-z0-9]+/).filter((m) => m.length > 2 && !MOTS_VIDES.has(m)))];
  if (!mots.length) return [];
  const lignes = await requete<ProducteurSuggere>(
    `select id, nom, region, pays, statut::text from producteur
      where statut <> 'retire' and ${SANS_ACCENTS} like any($1) limit 200`,
    [mots.map((m) => `%${m}%`)],
  );
  const score = (p: ProducteurSuggere) => {
    const n = norm(p.nom);
    return mots.filter((m) => n.includes(m)).length * 10 - Math.abs(n.length - norm(texte ?? '').length) / 10 + (p.statut === 'valide' ? 1 : 0);
  };
  return lignes.sort((a, b) => score(b) - score(a)).slice(0, limite);
}
