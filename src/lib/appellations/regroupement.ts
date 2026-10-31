// Appellations (terroirs) de la base de Pat : clé de comparaison, doublons probables à regrouper, appellation la plus proche.
// Sans « server-only » : fonctions pures, testées.
import { appellationCourte } from '../admin/intitule';

/** Clé d'une appellation : sans mention (AOC, DOC…), sans accents, tirets ni casse (« Bourgogne-Aligoté AOC » = « bourgogne aligote »). */
export const cleAppellation = (nom: string) => appellationCourte(nom.replace(/^(AOC|AOP|DOCG|DOC|IGP|IGT)\s+/i, ''))
  .normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').replace(/\bst\b/g, 'saint').trim();

/** Distance d'édition (lettres ajoutées, retirées ou changées), arrêtée au-delà de `max`. */
export function distance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cour = [i];
    let minLigne = i;
    for (let j = 1; j <= b.length; j++) {
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      minLigne = Math.min(minLigne, cour[j]);
    }
    if (minLigne > max) return max + 1;
    prec = cour;
  }
  return prec[b.length];
}

/**
 * Deux clés qui désignent sans doute la même appellation : identiques, ou une seule faute de frappe d'écart sur un nom
 * assez long, les mots étant les mêmes à part celui-là (« Sancere » / « Sancerre », pas « Eichberg » / « Kirchberg »).
 */
export function proches(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 7 || distance(a, b, 1) > 1) return false;
  const ma = a.split(' '), mb = b.split(' ');
  if (ma.length !== mb.length) return false;
  const differents = ma.filter((m, i) => m !== mb[i]);
  return differents.length === 1 && differents[0].length >= 5;
}

export interface AppellationListe { id: string; nom: string; statut: string; vins: number; region?: string | null }

/** Même région (ou région inconnue de l'une des deux) : deux « Steinberg » de deux régions sont deux lieux-dits. */
const memeRegion = (x: { region?: string | null }, y: { region?: string | null }) =>
  !x.region || !y.region || cleAppellation(x.region) === cleAppellation(y.region);

/**
 * Doublons probables : groupes d'appellations (non retirées) dont les noms sont proches. Dans chaque groupe,
 * celle à garder vient d'abord (validée, puis la plus utilisée, puis le nom le plus court).
 */
export function doublons<T extends AppellationListe>(liste: T[]): T[][] {
  const actives = liste.filter((a) => a.statut !== 'retire').map((a) => ({ a, k: cleAppellation(a.nom) })).filter((x) => x.k);
  // Comparaisons limitées aux noms de même initiale (plusieurs milliers d'appellations).
  const parInitiale = new Map<string, typeof actives>();
  for (const x of actives) parInitiale.set(x.k[0], [...(parInitiale.get(x.k[0]) ?? []), x]);
  const parent = new Map<string, string>();
  const racine = (id: string): string => { const p = parent.get(id) ?? id; return p === id ? id : racine(p); };
  for (const groupe of parInitiale.values()) {
    for (let i = 0; i < groupe.length; i++) for (let j = i + 1; j < groupe.length; j++) {
      if (memeRegion(groupe[i].a, groupe[j].a) && proches(groupe[i].k, groupe[j].k)) parent.set(racine(groupe[j].a.id), racine(groupe[i].a.id));
    }
  }
  const groupes = new Map<string, T[]>();
  for (const x of actives) groupes.set(racine(x.a.id), [...(groupes.get(racine(x.a.id)) ?? []), x.a]);
  const ordre = (x: T, y: T) => Number(y.statut === 'valide') - Number(x.statut === 'valide') || y.vins - x.vins || x.nom.length - y.nom.length;
  return [...groupes.values()].filter((g) => g.length > 1).map((g) => g.sort(ordre)).sort((x, y) => x[0].nom.localeCompare(y[0].nom, 'fr'));
}

/** Appellation de la base la plus proche d'un nom saisi (même clé, sinon une faute de frappe d'écart) ; null sinon. */
export function appellationProche<T extends { id: string; nom: string; statut: string }>(nom: string, base: T[]): T | null {
  const k = cleAppellation(nom);
  if (!k) return null;
  const candidates = base.filter((a) => a.statut !== 'retire');
  return candidates.find((a) => cleAppellation(a.nom) === k) ?? candidates.find((a) => proches(cleAppellation(a.nom), k)) ?? null;
}
