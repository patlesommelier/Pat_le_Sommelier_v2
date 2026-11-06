import 'server-only';
// Base des distributeurs de Quid Vinum. Deux lectures bien séparées :
// - super-admin : tout (prix public, prix QV, remise QV, remises des restaurants) ;
// - restaurants : le catalogue à leur prix (prix public moins leur remise) seulement, jamais le prix QV ni la commission.
import { requete } from '../db';
import { suggererProducteurs, type ProducteurBase, type Suggestion } from './rattachement';
import { distributeurPermis } from './verrou';
import { prixRestaurantSql } from './prix-restaurant';

export interface Distributeur {
  id: string; nom: string; adresse: string | null; tva: string | null; contact: string | null; telephone: string | null; email: string | null;
  site: string | null; remise_restaurant: number; remise_qv: number | null; calcul_qv: 'liste' | 'remise'; presentation: string | null; notes: string | null; actif: boolean;
  lecture_statut: 'en_cours' | 'terminee' | 'echec' | null; lecture_message: string | null; lecture_le: string | null;
  logo_url: string | null; source: 'fichier' | 'api'; modele_lecture: 'sonnet' | 'haiku' | 'opus';
  /** API du distributeur : adresse et nom de l'en-tête ; la clé elle-même ne sort jamais de la base (seulement « enregistrée »). */
  api_url: string | null; api_entete: string | null; api_cle_enregistree: boolean; api_synchro_le: string | null;
  completion_statut: 'en_cours' | 'terminee' | 'echec' | null; completion_message: string | null; completion_le: string | null;
}

// Colonnes lues (jamais api_cle).
const COLONNES = `d.id, d.nom, d.adresse, d.tva, d.contact, d.telephone, d.email, d.site, d.remise_restaurant::float8 as remise_restaurant, d.remise_qv::float8 as remise_qv, d.calcul_qv, d.presentation, d.notes, d.actif,
  d.lecture_statut, d.lecture_message, d.lecture_le::text, d.logo_url, d.source, d.modele_lecture, d.api_url, d.api_entete,
  d.api_cle is not null as api_cle_enregistree, d.api_synchro_le::text, d.completion_statut, d.completion_message, d.completion_le::text`;
export interface DistributeurListe extends Distributeur { vins: number; tarif_nom: string | null; tarif_le: string | null; restaurants: number }
export interface VinDistributeur {
  id: string; section: string | null; producteur_texte: string | null; libelle: string; millesime: string | null; contenance: string | null;
  couleur: string | null; certification: string | null; prix_qv: number | null; prix_restaurant: number | null; epuise: boolean; maximum: number | null;
  producteur_id: string | null; producteur_nom: string | null; producteur_manuel: boolean; actif: boolean;
  cuvee_id: string | null; cuvee_nom: string | null; cuvee_statut: string | null;
  reference: string | null; prix_catalogue: number | null; etiquette_url: string | null;
}

/** Un producteur tel qu'écrit sur le tarif, et son lien avec la base de Pat (ranking compris : réservé au super-admin). */
export interface ProducteurDuTarif {
  nom: string; vins: number; producteur_id: string | null; base_nom: string | null; ranking_pat: number | null; base_statut: string | null;
  manuel: boolean; suggestions: Suggestion[];
}

/** Marge par défaut de Quid Vinum (%), donnée à un restaurant quand il active un distributeur. */
/** Restaurants qui ont activé ce distributeur, avec leur remise propre (%) ; null : celle du distributeur. */
export async function restaurantsDistributeur(id: string) {
  return requete<{ fournisseur_id: string; restaurant: string; remise: number | null }>(
    `select f.id as fournisseur_id, r.nom as restaurant, f.remise::float8 as remise
       from fournisseur f join restaurant r on r.id = f.restaurant_id where f.distributeur_id = $1 order by lower(r.nom)`, [id]);
}

// ───────── Super-admin ─────────
export async function getDistributeurs() {
  return requete<DistributeurListe>(
    `select ${COLONNES},
            (select count(*)::int from distributeur_vin v where v.distributeur_id = d.id and v.actif) as vins,
            t.nom as tarif_nom, t.cree_le::text as tarif_le,
            (select count(*)::int from fournisseur f where f.distributeur_id = d.id) as restaurants
       from distributeur d
       left join lateral (select nom, cree_le from distributeur_tarif where distributeur_id = d.id order by cree_le desc limit 1) t on true
      order by lower(d.nom)`);
}

export async function getDistributeur(id: string) {
  const [d] = await requete<Distributeur & { tarif_id: string | null; tarif_nom: string | null; tarif_le: string | null }>(
    `select ${COLONNES}, t.id as tarif_id, t.nom as tarif_nom, t.cree_le::text as tarif_le from distributeur d
       left join lateral (select id, nom, cree_le from distributeur_tarif where distributeur_id = d.id order by cree_le desc limit 1) t on true
      where d.id = $1`, [id]);
  return d ?? null;
}

export async function getVinsDistributeur(id: string) {
  return requete<VinDistributeur>(
    `select v.id, v.section, v.producteur_texte, v.libelle, v.millesime, v.contenance, v.couleur, v.certification, v.prix_qv, v.prix_restaurant,
            v.epuise, v.maximum, v.producteur_id, p.nom as producteur_nom, v.producteur_manuel, v.actif,
            v.cuvee_id, c.nom as cuvee_nom, c.statut::text as cuvee_statut, v.reference, v.prix_catalogue, coalesce(v.etiquette_url, c.etiquette_url) as etiquette_url
       from distributeur_vin v left join producteur p on p.id = v.producteur_id left join cuvee c on c.id = v.cuvee_id
      where v.distributeur_id = $1 order by v.actif desc, v.ordre, v.libelle`, [id]);
}

/**
 * Producteurs du tarif (un par nom écrit), avec le producteur de la base relié et son ranking ;
 * pour ceux qui ne sont pas reliés, les producteurs proches de la base, proposés à Pat.
 */
export async function getProducteursDistributeur(id: string): Promise<ProducteurDuTarif[]> {
  const lignes = await requete<Omit<ProducteurDuTarif, 'suggestions'>>(
    `select coalesce(v.producteur_texte, '') as nom, count(*)::int as vins, (array_agg(v.producteur_id order by v.producteur_id nulls last))[1] as producteur_id,
            bool_or(v.producteur_manuel) as manuel
       from distributeur_vin v where v.distributeur_id = $1 and v.actif group by coalesce(v.producteur_texte, '') order by min(v.ordre)`, [id]);
  const base = await requete<ProducteurBase>(`select id, nom, region, ranking_pat, statut::text from producteur where statut <> 'retire'`);
  const parId = new Map(base.map((p) => [p.id, p]));
  return lignes.map((l) => {
    const p = l.producteur_id ? parId.get(l.producteur_id) : undefined;
    return { ...l, base_nom: p?.nom ?? null, ranking_pat: p?.ranking_pat ?? null, base_statut: p?.statut ?? null,
      suggestions: p || !l.nom ? [] : suggererProducteurs(l.nom, base) };
  });
}

/** Cuvées de la base des producteurs reliés à ce distributeur (pour choisir le vin de la base à la main). */
export async function getCuveesDistributeur(id: string) {
  return requete<{ id: string; producteur_id: string; nom: string; statut: string }>(
    `select c.id, c.producteur_id, c.nom, c.statut::text from cuvee c
      where c.statut <> 'retire' and c.producteur_id in (select producteur_id from distributeur_vin where distributeur_id = $1 and producteur_id is not null)
      order by c.nom`, [id]);
}

/**
 * Vins de ce distributeur dans la base de Pat (à valider ou validés) auxquels il manque les cépages, l'appellation ou la photo
 * (dont ceux déjà cherchés sans tout trouver) ; et ceux qui ne sont pas encore dans la base (producteur à relier).
 */
export async function vinsACompleter(id: string) {
  const [r] = await requete<{ n: number; deja: number; hors_base: number }>(
    `select count(*)::int as n, count(*) filter (where deja)::int as deja, (select count(*)::int from distributeur_vin v where v.distributeur_id = $1 and v.actif and v.cuvee_id is null) as hors_base
       from (select c.id, bool_or(v.cherche_le is not null) as deja from cuvee c join distributeur_vin v on v.cuvee_id = c.id and v.distributeur_id = $1 and v.actif
              where c.statut <> 'retire' and (coalesce(c.cepages, '') = '' or (c.appellation_id is null and coalesce(c.appellation_texte, '') = '')
                    or (c.etiquette_url is null and not exists (select 1 from distributeur_vin e where e.cuvee_id = c.id and e.etiquette_url is not null)))
              group by c.id) x`, [id]);
  return r;
}

/** Photos des vins de ce distributeur pas encore recadrées sur l'étiquette (photos différentes). */
export async function photosARecadrer(id: string) {
  const [{ n }] = await requete<{ n: number }>(
    `select count(distinct etiquette_url)::int as n from distributeur_vin where distributeur_id = $1 and actif and etiquette_url is not null and not etiquette_recadree`, [id]);
  return n;
}

// ───────── Coordonnées de Quid Vinum (bons de commande des restaurants) ─────────
export interface CoordonneesQv { nom: string; email: string | null; adresse: string | null; tva: string | null; telephone: string | null }
const CLES_QV = ['qv_nom', 'qv_email', 'qv_adresse', 'qv_tva', 'qv_telephone'] as const;

export async function getCoordonneesQv(): Promise<CoordonneesQv> {
  const r = new Map((await requete<{ cle: string; valeur: string }>('select cle, valeur from reglage_serveur where cle = any($1)', [[...CLES_QV]])).map((x) => [x.cle, x.valeur]));
  return { nom: r.get('qv_nom') || 'Quid Vinum', email: r.get('qv_email') ?? null, adresse: r.get('qv_adresse') ?? null, tva: r.get('qv_tva') ?? null, telephone: r.get('qv_telephone') ?? null };
}

export async function enregistrerCoordonneesQv(c: Record<(typeof CLES_QV)[number], string | null>) {
  for (const cle of CLES_QV) {
    const v = c[cle];
    if (v) await requete(`insert into reglage_serveur (cle, valeur) values ($1, $2) on conflict (cle) do update set valeur = excluded.valeur, maj_le = now()`, [cle, v]);
    else await requete('delete from reglage_serveur where cle = $1', [cle]);
  }
}

// ───────── Restaurants (prix proposé seulement) ─────────
export interface DistributeurPropose { id: string; nom: string; site: string | null; logo_url: string | null; vins: number; deja: boolean; presentation: string | null }
export interface VinCatalogueResto {
  id: string; section: string | null; producteur: string | null; producteur_id: string | null; libelle: string; millesime: string | null;
  contenance: string | null; couleur: string | null; certification: string | null; prix: number | null; epuise: boolean; maximum: number | null;
  reference: string | null; etiquette_url: string | null;
}

/** Distributeurs proposés aux restaurants (actifs, avec des vins) ; `deja` : déjà parmi les fournisseurs de ce restaurant. */
export async function distributeursProposes(resto: string) {
  return requete<DistributeurPropose>(
    `select d.id, d.nom, d.site, d.logo_url, d.presentation, count(v.id)::int as vins,
            exists (select 1 from fournisseur f where f.restaurant_id = $1 and f.distributeur_id = d.id) as deja
       from distributeur d join distributeur_vin v on v.distributeur_id = d.id and v.actif
      where d.actif and ${distributeurPermis('$1')} group by d.id order by lower(d.nom)`, [resto]);
}

/**
 * Vins de la carte du restaurant de chaque distributeur Quid Vinum (un vin, toutes contenances) : rattachés à lui, pris dans son catalogue,
 * ou, sans autre distributeur, un vin de la base de Pat qu'il vend.
 */
export async function vinsSurCarteParDistributeur(resto: string): Promise<Map<string, number>> {
  const lignes = await requete<{ distributeur_id: string; n: number }>(
    `select x.distributeur_id, count(distinct x.cle)::int as n from (
       select coalesce(f.distributeur_id, dv.distributeur_id) as distributeur_id, lower(v.libelle) || coalesce(v.millesime, '') as cle
         from vin_carte v left join fournisseur f on f.id = v.fournisseur_id left join distributeur_vin dv on dv.id = v.distributeur_vin_id
        where v.restaurant_id = $1 and v.disponible and coalesce(f.distributeur_id, dv.distributeur_id) is not null
       union all
       select c.distributeur_id, lower(v.libelle) || coalesce(v.millesime, '')
         from vin_carte v join distributeur_vin c on c.cuvee_id = v.cuvee_id and c.actif
        where v.restaurant_id = $1 and v.disponible and v.fournisseur_id is null and v.distributeur_vin_id is null) x group by 1`, [resto]);
  return new Map(lignes.map((x) => [x.distributeur_id, x.n]));
}

/** Catalogue d'un distributeur pour un restaurant : prix public moins la remise de ce restaurant (le prix QV ne sort pas d'ici). */
export async function catalogueDistributeur(distributeurId: string, resto: string) {
  return requete<VinCatalogueResto>(
    `select v.id, v.section, coalesce(p.nom, v.producteur_texte) as producteur, v.producteur_id, v.libelle, v.millesime, v.contenance, v.couleur,
            v.certification, ${prixRestaurantSql()}::float8 as prix, v.epuise, v.maximum, v.reference, coalesce(v.etiquette_url, c.etiquette_url) as etiquette_url
       from distributeur_vin v join distributeur d on d.id = v.distributeur_id left join producteur p on p.id = v.producteur_id
       left join cuvee c on c.id = v.cuvee_id
       left join fournisseur f on f.distributeur_id = d.id and f.restaurant_id = $2
      where v.distributeur_id = $1 and v.actif and d.actif and ${distributeurPermis('$2')} order by v.ordre, v.libelle`, [distributeurId, resto]);
}
