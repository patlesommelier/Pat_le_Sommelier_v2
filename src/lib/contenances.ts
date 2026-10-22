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

/** Mentions de contenant dans un intitulé (« M de Minuty – au verre », « Ostal Cazes (magnum) ») : ignorées pour reconnaître un même vin. */
const MENTION_CONTENANT = /\b(au verre|verres?|bouteilles?|demi[- ]bouteilles?|magnums?|pichets?|carafes?|pots?|\d+(?:[.,]\d+)?\s?cl)\b|½|¼/g;

/** Clé d'un même vin sur la carte (ses contenances sont enregistrées en lignes séparées) : couleur et intitulé, sans contenant. */
export const cleMemeVin = (v: { couleur: string; libelle: string }) =>
  [v.couleur, v.libelle.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(MENTION_CONTENANT, ' ').replace(/[^a-z0-9]+/g, ' ').trim()].join('|');

/**
 * Lignes de la carte regroupées par vin : même couleur et intitulé (mentions de contenant à part), des contenances différentes,
 * et le même millésime — une ligne sans millésime (souvent le verre) va avec celle qui en a un.
 * Deux lignes de même contenance sont deux vins distincts, même si la carte les a lus sous le même nom
 * (« Taittinger » brut et rosé, l'un sous l'autre) : elles ne sont jamais fusionnées.
 */
export function grouperMemeVin<T extends { couleur: string; libelle: string; millesime: string | null }>(lignes: T[], format: (l: T) => string | null | undefined): T[][] {
  const groupes: T[][] = [];
  const parCle = new Map<string, T[][]>();
  const millesime = (g: T[]) => g.find((x) => x.millesime)?.millesime ?? null;
  // Les lignes millésimées d'abord : une ligne sans millésime rejoint ensuite le vin de même nom qui n'a pas encore sa contenance.
  const ordre = [...lignes].sort((a, b) => Number(!a.millesime) - Number(!b.millesime));
  for (const l of ordre) {
    const c = contenanceDuFormat(format(l));
    const cle = cleMemeVin(l);
    const candidats = parCle.get(cle) ?? [];
    const g = candidats.find((x) => !x.some((y) => contenanceDuFormat(format(y)) === c)
      && (!l.millesime || !millesime(x) || millesime(x) === l.millesime));
    if (g) { g.push(l); continue; }
    const nouveau = [l];
    groupes.push(nouveau);
    parCle.set(cle, [...candidats, nouveau]);
  }
  // Ordre de la carte : celui de la première ligne de chaque vin, et ses lignes dans l'ordre d'origine.
  const rang = new Map(lignes.map((l, i) => [l, i]));
  for (const g of groupes) g.sort((a, b) => rang.get(a)! - rang.get(b)!);
  return groupes.sort((a, b) => rang.get(a[0])! - rang.get(b[0])!);
}

export interface Tarif { code: string; libelle: string; prix: number }
const ORDRE_TARIFS = ['bouteille', 'demi', 'quart', 'magnum', 'verre'];
const LIBELLES_TARIFS: Record<string, string> = { bouteille: 'Bouteille', demi: 'Demi-bouteille', quart: 'Quart de bouteille', magnum: 'Magnum', verre: 'Au verre' };

/**
 * Prix d'un vin dans chacune de ses contenances, à partir de ses lignes de carte (un groupe de grouperMemeVin), dans l'ordre
 * bouteille, demi, quart, magnum, verre. Au verre en plusieurs contenants (verres, pichet, carafe) : seul le prix le plus petit compte.
 */
export function tarifsDuGroupe(groupe: Array<{ format: string | null; prix: number | null; prix_verre: number | null }>): Tarif[] {
  const t: Tarif[] = [];
  const ajouter = (c: string, prix: number | null) => {
    if (prix == null) return;
    const deja = t.find((x) => x.code === c);
    if (!deja) t.push({ code: c, libelle: LIBELLES_TARIFS[c] ?? c, prix });
    else if (c === 'verre' && prix < deja.prix) deja.prix = prix;
  };
  const auVerre = groupe.some((l) => contenanceDuFormat(l.format) === 'verre' || l.prix_verre != null);
  for (const l of groupe) {
    if (auVerre && estPichet(l.format)) continue;
    const code = contenanceDuFormat(l.format);
    ajouter(code, code === 'verre' ? l.prix_verre ?? l.prix : l.prix);
    ajouter('verre', l.prix_verre);
  }
  return t.sort((a, b) => ORDRE_TARIFS.indexOf(a.code) - ORDRE_TARIFS.indexOf(b.code));
}
