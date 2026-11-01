// Tarifs des distributeurs (Quid Vinum) : vins lus sur le PDF par Claude, remis en forme, dédoublonnés ;
// prix proposé aux restaurants ; rapprochement d'un vin du tarif avec un vin de la carte d'un restaurant.
// Sans « server-only » : fonctions pures, testées.
import { centilitres } from '../contenances';

export interface VinTarif {
  section: string | null; producteur: string | null; libelle: string; millesime: string | null; contenance: string | null;
  couleur: string | null; certification: string | null; prix: number | null; epuise: boolean; maximum: number | null;
  /** Code article du distributeur (« SPFER200 ») et prix avant remise, quand le tarif les donne. */
  reference?: string | null; prixCatalogue?: number | null;
}

const COULEURS = new Set(['bulles', 'blanc', 'rose', 'orange', 'rouge', 'doux']);
const texte = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, max) : null);
const nombre = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/\s|€/g, '').replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
};

/** Contenance lisible (« 37,5 cl », « 150 cl ») ; null pour la bouteille de 75 cl. Accepte « 0,75 », « 1,5 L », « 3L », « 150cl ». */
export function contenanceTarif(v: unknown): string | null {
  const t = texte(v, 30);
  if (!t) return null;
  const m = t.replace(/\s+/g, '').toLowerCase().match(/^(\d+(?:[.,]\d+)?)(l|cl)?$/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const cl = Math.round((m[2] === 'l' || (!m[2] && n <= 6) ? n * 100 : n) * 10) / 10; // un nombre seul jusqu'à 6 : des litres
  if (!cl || cl === 75) return null;
  return `${String(cl).replace('.', ',')} cl`;
}

/** Un vin lu par Claude, vérifié et remis en forme ; null s'il est inutilisable (sans nom). */
export function vinTarif(brut: unknown): VinTarif | null {
  if (!brut || typeof brut !== 'object') return null;
  const b = brut as Record<string, unknown>;
  const libelle = texte(b.vin ?? b.libelle);
  if (!libelle) return null;
  const millesime = texte(b.millesime, 9);
  const couleur = texte(b.couleur, 20)?.toLowerCase().replace('rosé', 'rose') ?? null;
  const max = nombre(b.max ?? b.maximum);
  return {
    section: texte(b.section, 120), producteur: texte(b.producteur, 160), libelle,
    millesime: millesime && /^\d{4}(-\d{4})?$/.test(millesime) ? millesime : null,
    contenance: contenanceTarif(b.contenance), couleur: couleur && COULEURS.has(couleur) ? couleur : null,
    certification: texte(b.certification, 20)?.toUpperCase() ?? null, prix: nombre(b.prix),
    epuise: b.epuise === true || /epuis|épuis/i.test(String(b.dispo ?? '')), maximum: max && Number.isInteger(max) ? max : null,
    reference: texte(b.reference, 40)?.replace(/\s+/g, '') ?? null, prixCatalogue: nombre(b.prix_catalogue ?? b.prixCatalogue),
  };
}

// ─── Clés et mots ───
const MOTS_VIDES = new Set(['domaine', 'dom', 'chateau', 'maison', 'cave', 'clos', 'des', 'du', 'de', 'la', 'le', 'les', 'et', 'l', 'd', 'en', 'a',
  'vin', 'vins', 'cuvee', 'aoc', 'aop', 'igp', 'vdf', 'france']);
export const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe');
export const motsDe = (t: string | null | undefined) =>
  [...new Set(sansAccents(t ?? '').split(/[^a-z0-9]+/).filter((m) => m.length > 1 && !MOTS_VIDES.has(m) && !/^\d+(cl)?$/.test(m)))];

/** Clé d'un vin du tarif : la même d'un tarif à l'autre (sa référence d'article, sinon ses mots triés, sans accents ni ponctuation). */
export const cleVin = (v: Pick<VinTarif, 'producteur' | 'libelle' | 'millesime' | 'contenance' | 'reference'>) => (v.reference
  ? `ref:${v.reference.toUpperCase()}`
  : [motsDe(v.producteur).sort().join(' '), motsDe(v.libelle).sort().join(' '), v.millesime ?? '', v.contenance ?? ''].join('|'));

/**
 * Un vin peut figurer plusieurs fois dans un tarif (« Vins pour les menus », « Grands formats », puis la page du domaine) :
 * même vin, même millésime, même contenance et même prix. On garde la ligne la plus complète (producteur le plus long :
 * celui du titre de la page du domaine), à la place de la première rencontrée.
 */
export function dedoublonner(vins: VinTarif[]): VinTarif[] {
  const garde = new Map<string, VinTarif>();
  const memeVin = (v: VinTarif) => v.reference ? `ref:${v.reference}` : [motsDe(v.libelle).sort().join(' '), v.millesime ?? '', v.contenance ?? '', v.prix ?? ''].join('|');
  for (const v of vins) {
    const k = memeVin(v);
    const deja = garde.get(k);
    // Même vin sous deux producteurs vraiment différents : deux vins.
    if (deja && deja.producteur && v.producteur && !motsDe(deja.producteur).some((m) => motsDe(v.producteur).includes(m))) {
      garde.set(`${k}|${cleVin(v)}`, v);
      continue;
    }
    if (!deja) { garde.set(k, v); continue; }
    const plusComplet = (v.producteur?.length ?? 0) > (deja.producteur?.length ?? 0);
    garde.set(k, {
      ...(plusComplet ? v : deja),
      section: (plusComplet ? v : deja).section ?? deja.section ?? v.section,
      couleur: deja.couleur ?? v.couleur, certification: deja.certification ?? v.certification,
      epuise: deja.epuise || v.epuise, maximum: deja.maximum ?? v.maximum, reference: deja.reference ?? v.reference, prixCatalogue: deja.prixCatalogue ?? v.prixCatalogue,
    });
  }
  return [...garde.values()];
}

/** Prix proposé aux restaurants : le prix imposé, sinon le prix QV + la marge du distributeur, au centime. */
export type CalculQv = 'liste' | 'remise';

/**
 * Prix publié et prix QV d'un vin lu dans un tarif. « liste » : la liste donne le prix QV (le prix barré éventuel est le prix publié).
 * « remise » : le prix publié (le plus haut si la liste en donne deux) moins la remise QV du distributeur.
 */
export function prixDuTarif(prixLu: number | null, prixCatalogue: number | null, calcul: CalculQv, remise: number | null): { publie: number | null; qv: number | null } {
  if (calcul === 'remise' && remise != null) {
    const publie = prixCatalogue ?? prixLu;
    return { publie, qv: prixRemise(publie, remise) };
  }
  return { publie: prixCatalogue, qv: prixLu };
}

/** Prix publié moins la remise (%), arrondi au centime. */
export function prixRemise(publie: number | null, remise: number): number | null {
  return publie == null ? null : Math.round(publie * (1 - remise / 100) * 100) / 100;
}

export function prixPropose(prixQv: number | null, marge: number, impose: number | null = null): number | null {
  if (impose != null) return impose;
  if (prixQv == null) return null;
  return Math.round(prixQv * (1 + marge / 100) * 100) / 100;
}

// ─── Rapprochement avec la carte d'un restaurant ───
export interface VinCarteSimple { id: string; libelle: string; millesime: string | null; format: string | null; producteur_id: string | null; producteur: string | null }
export interface VinCatalogue { id: string; libelle: string; millesime: string | null; contenance: string | null; producteur_id: string | null; producteur: string | null }

/**
 * Vin de la carte qui correspond à ce vin du tarif : même contenance, même millésime (ou aucun des deux), même producteur
 * (le même producteur de la base de Pat, sinon des mots communs), et les mêmes mots dans le nom, une fois le producteur retiré
 * (« Chablis » n'est pas « Chablis 1er Cru », « Sancerre » n'est pas « Sancerre rouge »). En cas de doute (plusieurs vins possibles), aucun.
 */
export function vinDeLaCarte(v: VinCatalogue, carte: VinCarteSimple[]): VinCarteSimple | null {
  const cl = (f: string | null) => centilitres(f) ?? 75;
  const nomTarif = motsDe(v.libelle);
  const prodTarif = motsDe(v.producteur);
  const trouves = carte.filter((c) => {
    if (cl(c.format) !== cl(v.contenance)) return false;
    if ((c.millesime ?? '') !== (v.millesime ?? '')) return false;
    const memeProducteur = v.producteur_id && c.producteur_id ? v.producteur_id === c.producteur_id
      : prodTarif.length > 0 && motsDe(c.producteur).some((m) => prodTarif.includes(m));
    if (!memeProducteur) return false;
    const nomCarte = motsDe(c.libelle).filter((m) => !prodTarif.includes(m));
    const reste = nomTarif.filter((m) => !prodTarif.includes(m));
    if (!reste.length || !nomCarte.length) return false;
    return reste.length === nomCarte.length && reste.every((m) => nomCarte.includes(m));
  });
  return trouves.length === 1 ? trouves[0] : null;
}

// ─── Vin de la carte confié à un distributeur : son vin dans le catalogue ───
export interface VinCatalogueComplet extends VinCatalogue { couleur: string | null; cuvee_id: string | null }
export interface VinCarteComplet extends VinCarteSimple { couleur: string | null; cuvee_id: string | null }

const MOTS_COULEUR: Record<string, string> = { rouge: 'rouge', blanc: 'blanc', blanche: 'blanc', rose: 'rose', bulles: 'bulles', orange: 'orange' };
const couleurDe = (couleur: string | null, libelle: string) => couleur ?? motsDe(libelle).map((m) => MOTS_COULEUR[m]).find(Boolean) ?? null;

/**
 * Le vin du catalogue d'un distributeur qui correspond à un vin de la carte (le restaurant vient de choisir ce distributeur
 * comme fournisseur). Le même vin de la base de Pat, sinon le même nom une fois retirés le producteur et la couleur
 * (« Sancerre Terre de Maimbray » = « Sancerre blanc "Terre de Maimbray" »), avec le même producteur s'il est connu des deux côtés
 * et la même couleur. Même contenance ; le même millésime de préférence, sinon le plus récent. Aucun en cas de doute.
 */
export function offreDuCatalogue(vin: VinCarteComplet, catalogue: VinCatalogueComplet[]): VinCatalogueComplet | null {
  const cl = (f: string | null) => centilitres(f) ?? 75;
  const couleurVin = couleurDe(vin.couleur, vin.libelle);
  const prodVin = motsDe(vin.producteur).filter((m) => m.length >= 4);
  let candidats = vin.cuvee_id ? catalogue.filter((c) => c.cuvee_id === vin.cuvee_id) : [];
  if (!candidats.length) {
    candidats = catalogue.filter((c) => {
      const couleur = couleurDe(c.couleur, c.libelle);
      if (couleurVin && couleur && couleurVin !== couleur) return false;
      const prodCat = motsDe(c.producteur).filter((m) => m.length >= 4);
      if (vin.producteur_id && c.producteur_id) { if (vin.producteur_id !== c.producteur_id) return false; }
      else if (prodVin.length && prodCat.length && !prodVin.some((m) => prodCat.includes(m))) return false;
      const retirer = new Set([...prodVin, ...prodCat, ...Object.keys(MOTS_COULEUR)]);
      const a = motsDe(vin.libelle).filter((m) => !retirer.has(m)), b = motsDe(c.libelle).filter((m) => !retirer.has(m));
      return a.length > 0 && a.length === b.length && a.every((m) => b.includes(m));
    });
    // Plusieurs vins différents (pas seulement des millésimes) : on ne choisit pas.
    if (new Set(candidats.map((c) => motsDe(c.libelle).sort().join(' ') + '|' + couleurDe(c.couleur, c.libelle))).size > 1) return null;
  }
  candidats = candidats.filter((c) => cl(c.contenance) === cl(vin.format));
  if (!candidats.length) return null;
  return candidats.find((c) => (c.millesime ?? '') === (vin.millesime ?? ''))
    ?? [...candidats].sort((x, y) => (y.millesime ?? '').localeCompare(x.millesime ?? ''))[0];
}
