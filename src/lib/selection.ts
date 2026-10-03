/**
 * Règles de sélection des vins — fichier regles_selection.xlsx (V7, 30/09/2026).
 * Module pur (aucun accès à la base) : utilisé par l'app et par `npm run cas-test`.
 *
 * Onglet « Plat seul » :
 *   10. contenance : un vin présent en 75 cl et en 37,5 cl ne compte qu'en 75 cl
 *    1. élimination : note ≤ 2 écartée
 *    2. score = note + ranking producteur ; 2 bis : à score égal, la note la plus haute
 *    3. diversité (catégorie, pays, cépage, appellation) ; 4. ranking producteur puis terroir ; 5. ordre de la carte
 *    6. 4e et 5e vins ; 7. vin plus cher ; 8. vin moins cher ; 9. 1 à 5 vins ; 11. plafond bulles
 * Onglet « Plusieurs plats » : note = la plus basse sur les plats, pas de règle de diversité.
 * Onglet « Tour 2 et verre » : les trois vins suivants du classement, sans les règles 6 à 8.
 */

export interface Candidat {
  id: string;
  libelle: string;
  couleur: string;            // rouge, blanc, rose, doux, bulles (tout effervescent = bulles)
  format: string;             // 75 cl, 37,5 cl, au verre…
  prix: number | null;
  ordre: number;              // ordre de la carte (fichier 1 puis fichier 2)
  ranking_producteur: number | null;
  ranking_terroir: number | null;
  pays: string | null;
  cepages: string | null;
  appellation: string | null;
  /** Note d'accord par plat (/5). */
  notes: Record<string, number>;
}

export type Motif = 'classement' | 'quatrieme_cinquieme' | 'plus_cher' | 'moins_cher' | 'tour_suivant';

export interface Retenu<C extends Candidat = Candidat> {
  vin: C;
  note: number;
  score: number;
  motif: Motif;
}

export interface Selection<C extends Candidat = Candidat> {
  liste: Retenu<C>[];
  /** Classement complet après les filtres (règles 10 et 1), sans la diversité : sert au tour suivant. */
  classement: Retenu<C>[];
}

const NOTE_ELIMINATOIRE = 2;   // règle 1
const PREMIERS = 3;            // règles 3 à 5 : les trois premiers vins
const MAXIMUM = 5;             // règle 9
const SCORE_MINIMUM_AJOUT = 7; // règle 6c
const FACTEUR_PLUS_CHER = 1.5; // règle 7b
const ECART_MOINS_CHER = 1.3;  // règle 8 (déclenchement)
const PLAFOND_BULLES = 2;      // règle 11

const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** « Chardonnay (61 %), Pinot noir (39 %) » → « chardonnay|pinot noir » ; l'ordre et les précisions ne comptent pas. */
function cepagesCle(c: string | null) {
  return norm(c)
    .replace(/\([^)]*\)/g, '')
    .split(/,|;|\bet\b/)
    .map((x) => x.trim())
    .filter((x) => x && !/a verifier|non confirme/.test(x))
    .sort()
    .join('|');
}

/** Clé d'identité d'un vin pour la règle 10 : le même libellé (sans contenance ni millésime). */
const memeVin = (v: Candidat) => norm(v.libelle);

const estBulle = (v: Candidat) => v.couleur === 'bulles';

/** Règle 10 : la demi-bouteille d'un vin qui existe en 75 cl est écartée avant le classement. */
function contenance<C extends Candidat>(vins: C[]): C[] {
  const en75 = new Set(vins.filter((v) => v.format === '75 cl').map(memeVin));
  return vins.filter((v) => v.format === '75 cl' || !en75.has(memeVin(v)));
}

/** Note du vin pour un ou plusieurs plats (« Plusieurs plats » : la plus basse). null si un plat n'est pas noté. */
function noteSur(v: Candidat, plats: string[]): number | null {
  const n = plats.map((p) => v.notes[p]);
  return n.every((x) => typeof x === 'number') ? Math.min(...n) : null;
}

/** Départages qui ne dépendent pas de la liste : règles 2, 2 bis, 4 et 5. */
function compare(a: Retenu, b: Retenu) {
  return (
    b.score - a.score ||
    b.note - a.note ||
    (b.vin.ranking_producteur ?? 0) - (a.vin.ranking_producteur ?? 0) ||
    (b.vin.ranking_terroir ?? 0) - (a.vin.ranking_terroir ?? 0) ||
    a.vin.ordre - b.vin.ordre
  );
}

/** Règle 3 : vecteur « différent de tous les vins déjà retenus » sur catégorie, pays, cépage, appellation. */
function diversite(v: Candidat, liste: Candidat[]): number[] {
  const absent = (f: (x: Candidat) => string) => (liste.some((x) => f(x) === f(v)) ? 0 : 1);
  return [
    absent((x) => x.couleur),
    absent((x) => norm(x.pays)),
    absent((x) => cepagesCle(x.cepages)),
    absent((x) => norm(x.appellation)),
  ];
}

/** Règle 11 : deux bulles au plus, trois si tous les vins notés 5 du classement sont des bulles. */
function plafondBulles(classement: Retenu[]) {
  const cinq = classement.filter((r) => r.note === 5);
  return cinq.length && cinq.every((r) => estBulle(r.vin)) ? PLAFOND_BULLES + 1 : PLAFOND_BULLES;
}

/**
 * Prend le prochain vin parmi `restants` (déjà triés), en appliquant la diversité aux ex aequo (score et note)
 * si `avecDiversite`, et en sautant les bulles quand le plafond est atteint.
 */
function suivant<C extends Candidat>(restants: Retenu<C>[], liste: Retenu<C>[], plafond: number, avecDiversite: boolean, accepte: (r: Retenu<C>) => boolean = () => true) {
  const bullesPleines = liste.filter((r) => estBulle(r.vin)).length >= plafond;
  const possibles = restants.filter((r) => !(bullesPleines && estBulle(r.vin)) && accepte(r));
  if (!possibles.length) return null;
  const tete = possibles[0];
  if (!avecDiversite || !liste.length) return tete;
  const exAequo = possibles.filter((r) => r.score === tete.score && r.note === tete.note);
  if (exAequo.length < 2) return tete;
  const deja = liste.map((r) => r.vin);
  // Le premier critère qui diffère tranche ; à égalité complète, l'ordre du classement (règles 4 et 5) reste.
  return exAequo
    .map((r) => ({ r, d: diversite(r.vin, deja) }))
    .sort((x, y) => {
      for (let i = 0; i < x.d.length; i++) if (x.d[i] !== y.d[i]) return y.d[i] - x.d[i];
      return compare(x.r, y.r);
    })[0].r;
}

export interface Options {
  /** Règle 3 (diversité). Vraie pour « Plat seul », fausse pour « Plusieurs plats ». */
  diversite?: boolean;
}

/** Sélection « Plat seul » (un plat) ou « Plusieurs plats » (plusieurs). */
export function selectionner<C extends Candidat>(vins: C[], plats: string[], options: Options = {}): Selection<C> {
  const avecDiversite = options.diversite ?? plats.length === 1;

  // Règles 10, 1 et 2 → classement
  const classement: Retenu<C>[] = contenance(vins)
    .map((vin) => {
      const note = noteSur(vin, plats);
      return note === null ? null : { vin, note, score: note + (vin.ranking_producteur ?? 0), motif: 'classement' as Motif };
    })
    .filter((r): r is Retenu<C> => r !== null && r.note > NOTE_ELIMINATOIRE)
    .sort(compare);
  const plafond = plafondBulles(classement);

  // Règles 3 à 5 : les trois premiers vins
  const liste: Retenu<C>[] = [];
  const restants = () => classement.filter((r) => !liste.some((l) => l.vin.id === r.vin.id));
  while (liste.length < PREMIERS) {
    const r = suivant(restants(), liste, plafond, avecDiversite);
    if (!r) break;
    liste.push(r);
  }
  if (liste.length < PREMIERS) return { liste, classement };

  // Règle 6 : 4e et 5e vins (note 4 ou 5, score ≥ score du 3e − 1, score ≥ 7)
  const scoreTroisieme = liste[PREMIERS - 1].score;
  while (liste.length < MAXIMUM) {
    const r = suivant(restants(), liste, plafond, avecDiversite,
      (c) => c.note >= 4 && c.score >= scoreTroisieme - 1 && c.score >= SCORE_MINIMUM_AJOUT);
    if (!r) break;
    liste.push({ ...r, motif: liste.length >= PREMIERS ? 'quatrieme_cinquieme' : 'classement' });
  }

  // État après la règle 6 : sert aux règles 7 et 8
  const apres6 = [...liste];
  const prix6 = apres6.map((r) => r.vin.prix).filter((p): p is number => p !== null);
  const dernier6 = apres6[apres6.length - 1];
  const maxPrix = Math.max(...prix6);
  const minPrix = Math.min(...prix6);

  // Règle 7 : vin plus cher (toujours recherché)
  const plusCher = prix6.length
    ? restants().find((c) => c.note >= 4 && c.vin.prix !== null && c.vin.prix >= FACTEUR_PLUS_CHER * maxPrix && c.score >= dernier6.score - 1)
    : undefined;
  if (plusCher) {
    const ajout = { ...plusCher, motif: 'plus_cher' as Motif };
    const bulles = liste.filter((r) => estBulle(r.vin));
    if (estBulle(plusCher.vin) && bulles.length >= plafond) {
      // Exception bulles : remplace la dernière bulle retenue, puis prend la dernière place.
      liste.splice(liste.indexOf(bulles[bulles.length - 1]), 1);
      liste.push(ajout);
    } else if (liste.length >= MAXIMUM) {
      liste[MAXIMUM - 1] = ajout;
    } else {
      liste.push(ajout);
    }
  }

  // Règle 8 : vin moins cher, seulement si l'écart de prix de la liste (après la règle 6) est inférieur à 1,3
  if (prix6.length && maxPrix < ECART_MOINS_CHER * minPrix) {
    const bullesPleines = liste.filter((r) => estBulle(r.vin)).length >= plafond;
    const moinsCher = restants().find((c) =>
      c.note >= 4 && c.vin.prix !== null && c.vin.prix <= minPrix / 2 && c.score >= dernier6.score - 2 && !(bullesPleines && estBulle(c.vin)));
    if (moinsCher) {
      const ajout = { ...moinsCher, motif: 'moins_cher' as Motif };
      if (liste.length < MAXIMUM) liste.push(ajout);
      else {
        // Remplace le dernier vin issu de la règle 6, jamais le vin plus cher de la règle 7.
        const i = liste.map((r) => r.motif).lastIndexOf('quatrieme_cinquieme');
        const j = i >= 0 ? i : liste.findLastIndex((r) => r.motif !== 'plus_cher');
        liste[j] = ajout;
      }
    }
  }

  return { liste, classement };
}

/**
 * « Tour 2 et verre », règle 1 : les trois vins suivants du classement, en reprenant après la liste précédente.
 * Les règles 6 à 8 ne s'appliquent pas ; le plafond de bulles s'applique à la nouvelle liste.
 */
export function tourSuivant<C extends Candidat>(sel: Selection<C>, dejaProposes: string[], nombre = PREMIERS, avecDiversite = true): Retenu<C>[] {
  const plafond = plafondBulles(sel.classement);
  const exclus = new Set(dejaProposes);
  const liste: Retenu<C>[] = [];
  while (liste.length < nombre) {
    const restants = sel.classement.filter((r) => !exclus.has(r.vin.id) && !liste.some((l) => l.vin.id === r.vin.id));
    const r = suivant(restants, liste, plafond, avecDiversite);
    if (!r) break;
    liste.push({ ...r, motif: 'tour_suivant' });
  }
  return liste;
}
