import 'server-only';
// Base des distributeurs de Quid Vinum. Deux lectures bien séparées :
// - super-admin : tout (prix QV, marge, remise) ;
// - restaurants : le catalogue au prix proposé seulement, jamais le prix QV ni la marge.
import { requete } from '../db';

export interface Distributeur {
  id: string; nom: string; adresse: string | null; tva: string | null; contact: string | null; telephone: string | null; email: string | null;
  site: string | null; marge: number; remise_qv: number | null; notes: string | null; actif: boolean;
  lecture_statut: 'en_cours' | 'terminee' | 'echec' | null; lecture_message: string | null; lecture_le: string | null;
  logo_url: string | null; source: 'fichier' | 'api'; modele_lecture: 'sonnet' | 'haiku' | 'opus';
  /** API du distributeur : adresse et nom de l'en-tête ; la clé elle-même ne sort jamais de la base (seulement « enregistrée »). */
  api_url: string | null; api_entete: string | null; api_cle_enregistree: boolean; api_synchro_le: string | null;
}

// Colonnes lues (jamais api_cle).
const COLONNES = `d.id, d.nom, d.adresse, d.tva, d.contact, d.telephone, d.email, d.site, d.marge::float8 as marge, d.remise_qv::float8 as remise_qv, d.notes, d.actif,
  d.lecture_statut, d.lecture_message, d.lecture_le::text, d.logo_url, d.source, d.modele_lecture, d.api_url, d.api_entete,
  d.api_cle is not null as api_cle_enregistree, d.api_synchro_le::text`;
export interface DistributeurListe extends Distributeur { vins: number; tarif_nom: string | null; tarif_le: string | null; restaurants: number }
export interface VinDistributeur {
  id: string; section: string | null; producteur_texte: string | null; libelle: string; millesime: string | null; contenance: string | null;
  couleur: string | null; certification: string | null; prix_qv: number | null; prix_restaurant: number | null; epuise: boolean; maximum: number | null;
  producteur_id: string | null; producteur_nom: string | null; producteur_manuel: boolean; actif: boolean;
}

/** Prix proposé aux restaurants, en SQL (v : distributeur_vin, d : distributeur) — même calcul que prixPropose(). */
export const SQL_PRIX_PROPOSE = 'coalesce(v.prix_restaurant, round(v.prix_qv * (1 + d.marge / 100), 2))';

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
            v.epuise, v.maximum, v.producteur_id, p.nom as producteur_nom, v.producteur_manuel, v.actif
       from distributeur_vin v left join producteur p on p.id = v.producteur_id
      where v.distributeur_id = $1 order by v.actif desc, v.ordre, v.libelle`, [id]);
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
export interface DistributeurPropose { id: string; nom: string; site: string | null; logo_url: string | null; vins: number; deja: boolean }
export interface VinCatalogueResto {
  id: string; section: string | null; producteur: string | null; producteur_id: string | null; libelle: string; millesime: string | null;
  contenance: string | null; couleur: string | null; certification: string | null; prix: number | null; epuise: boolean; maximum: number | null;
}

/** Distributeurs proposés aux restaurants (actifs, avec des vins) ; `deja` : déjà parmi les fournisseurs de ce restaurant. */
export async function distributeursProposes(resto: string) {
  return requete<DistributeurPropose>(
    `select d.id, d.nom, d.site, d.logo_url, count(v.id)::int as vins,
            exists (select 1 from fournisseur f where f.restaurant_id = $1 and f.distributeur_id = d.id) as deja
       from distributeur d join distributeur_vin v on v.distributeur_id = d.id and v.actif
      where d.actif group by d.id order by lower(d.nom)`, [resto]);
}

/** Catalogue d'un distributeur au prix proposé (le prix QV et la marge ne sortent pas d'ici). */
export async function catalogueDistributeur(distributeurId: string) {
  return requete<VinCatalogueResto>(
    `select v.id, v.section, coalesce(p.nom, v.producteur_texte) as producteur, v.producteur_id, v.libelle, v.millesime, v.contenance, v.couleur,
            v.certification, ${SQL_PRIX_PROPOSE}::float8 as prix, v.epuise, v.maximum
       from distributeur_vin v join distributeur d on d.id = v.distributeur_id left join producteur p on p.id = v.producteur_id
      where v.distributeur_id = $1 and v.actif and d.actif order by v.ordre, v.libelle`, [distributeurId]);
}
