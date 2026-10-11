// Contenances d'un vin (cases à cocher de la fiche du back-office) : bouteille, ½, ¼, verre, et magnum s'il est sur la carte.
// Détectées à la lecture de la carte des vins (contenance et prix au verre de chaque ligne) ; sans information : une bouteille.

export const CONTENANCES = [
  { code: 'bouteille', libelle: 'Bouteille', court: 'Bouteille' },
  { code: 'demi', libelle: '½ bouteille', court: '½' },
  { code: 'quart', libelle: '¼ bouteille', court: '¼' },
  { code: 'verre', libelle: 'Verre', court: 'Verre' },
  { code: 'magnum', libelle: 'Magnum', court: 'Magnum' },
] as const;
export type Contenance = (typeof CONTENANCES)[number]['code'];

const CODES = new Set<string>(CONTENANCES.map((c) => c.code));
export const PAR_DEFAUT: Contenance[] = ['bouteille'];

/** Contenance d'une ligne de la carte d'après son format (« 75 cl », « 37,5 cl », « au verre »…). */
export function contenanceDuFormat(format: string | null | undefined): Contenance {
  const f = (format ?? '').replace(/\s+/g, '').toLowerCase();
  if (/verre/.test(f)) return 'verre';
  const cl = Number(f.replace(',', '.').replace(/cl$/, ''));
  if (!Number.isFinite(cl) || !cl) return 'bouteille';
  if (cl < 17) return 'verre';
  if (cl >= 140) return 'magnum';
  if (cl >= 70) return 'bouteille';
  if (cl >= 35) return 'demi';
  return 'quart';
}

/** Centilitres d'un format (« 12 cl », « 37,5 cl ») ; null s'il n'en indique pas. */
export function centilitres(format: string | null | undefined): number | null {
  const m = (format ?? '').replace(/\s+/g, '').toLowerCase().match(/^(\d+(?:[.,]\d+)?)cl$/);
  return m ? Number(m[1].replace(',', '.')) : null;
}

/** Un verre (moins de 17 cl) : « 12 cl », « 15 cl ». */
export const estTailleVerre = (format: string | null | undefined) => { const cl = centilitres(format); return cl != null && cl < 17; };

/** Bouteilles usuelles (quart de champagne, demi, clavelin, bouteille, magnum et plus) : tout le reste est un pichet, une carafe ou un pot. */
const BOUTEILLES = [18.7, 20, 37.5, 62, 70, 75];
export const estPichet = (format: string | null | undefined) => {
  const cl = centilitres(format);
  return cl != null && cl >= 17 && cl < 100 && !BOUTEILLES.includes(cl);
};

/** Contenances d'un vin à partir de ses lignes de carte (une par contenance), dans l'ordre des cases. */
export function contenancesDesLignes(lignes: Array<{ format?: string | null; prixVerre?: number | null }>): Contenance[] {
  const vues = new Set<Contenance>();
  for (const l of lignes) {
    vues.add(contenanceDuFormat(l.format));
    if (l.prixVerre != null) vues.add('verre');
  }
  return ordonner([...vues]);
}

/** Cases cochées (ou valeurs enregistrées) : codes connus, dans l'ordre ; aucune → une bouteille. */
export function ordonner(codes: readonly string[] | null | undefined): Contenance[] {
  const ok = CONTENANCES.map((c) => c.code).filter((c) => (codes ?? []).includes(c) && CODES.has(c));
  return ok.length ? ok : [...PAR_DEFAUT];
}

export const libelleCourt = (code: string) => CONTENANCES.find((c) => c.code === code)?.court ?? code;

/** Clé d'un même vin sur la carte (ses contenances sont enregistrées en lignes séparées). */
export const cleMemeVin = (v: { couleur: string; libelle: string; millesime: string | null }) =>
  [v.couleur, v.libelle.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), v.millesime ?? ''].join('|');

/**
 * Lignes de la carte regroupées par vin : même couleur, intitulé et millésime, et des contenances différentes.
 * Deux lignes de même contenance sont deux vins distincts, même si la carte les a lus sous le même nom
 * (« Taittinger » brut et rosé, l'un sous l'autre) : elles ne sont jamais fusionnées.
 */
export function grouperMemeVin<T extends { couleur: string; libelle: string; millesime: string | null }>(lignes: T[], format: (l: T) => string | null | undefined): T[][] {
  const groupes: T[][] = [];
  const parCle = new Map<string, T[][]>();
  for (const l of lignes) {
    const c = contenanceDuFormat(format(l));
    const candidats = parCle.get(cleMemeVin(l)) ?? [];
    const g = candidats.find((x) => !x.some((y) => contenanceDuFormat(format(y)) === c));
    if (g) { g.push(l); continue; }
    const nouveau = [l];
    groupes.push(nouveau);
    parCle.set(cleMemeVin(l), [...candidats, nouveau]);
  }
  return groupes;
}
