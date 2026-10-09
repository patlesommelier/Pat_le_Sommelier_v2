// Intitulé d'un vin (« libellé » affiché dans l'app et sur la carte), composé à partir de ses champs modifiables :
// appellation, nom du vin (cuvée), cépage et producteur. Le restaurant peut aussi l'écrire lui-même.
// Sans dépendance serveur : utilisé par le formulaire (navigateur) et par le serveur.

export type ChampsIntitule = { appellation?: string | null; nom?: string | null; cepage?: string | null; producteur?: string | null };

const propre = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const cle = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Appellation sans mention d'origine protégée (« Chablis AOC » → « Chablis »). */
export const appellationCourte = (s: string | null | undefined) => propre(s).replace(/\s+(AOC|AOP|DOC|DOCG|DO|DOCa)$/i, '');

/** Appellations qui ne disent pas le cépage (vins de pays, IGP…) : le cépage aide alors à reconnaître le vin. */
const GENERIQUE = /^(IGP|IGT|VdP|Vin de France|Vin de pays|Pays d|Terre|Landwein|Vino de la Tierra)\b/i;

/**
 * Intitulé proposé : appellation, cépage (seulement s'il est unique et que l'appellation ne le dit pas), puis le nom du vin,
 * ou le producteur quand le vin n'a pas de nom. Un élément déjà contenu dans un autre n'est pas répété.
 * Ex. « Chablis Saint-Pierre », « Chiroubles Domaine Piron », « IGP Val de Loire Sauvignon Le Petit Bourgeois ».
 */
export function composerIntitule({ appellation, nom, cepage, producteur }: ChampsIntitule) {
  const a = appellationCourte(appellation);
  const n = propre(nom);
  const c = propre(cepage);
  // Cépage déjà cité (même en partie : « Sauvignon » pour « Sauvignon blanc ») : pas répété.
  const dejaCite = c && ` ${cle(`${a} ${n}`)} `.includes(` ${cle(c).split(' ')[0]} `);
  const parties = [
    a,
    c && !dejaCite && !/[,/&+]| et /.test(c) && (!a || GENERIQUE.test(a)) ? c : '',
    n || propre(producteur).replace(/\s*\(.*?\)/g, ''),
  ].filter(Boolean);
  const gardees = parties.filter((p, i) => !parties.some((q, j) => j !== i && q.length > p.length && ` ${cle(q)} `.includes(` ${cle(p)} `)));
  return gardees.join(' ');
}

/** Appellation lue sur la carte à l'import (« Pauillac – Le Petit Mouton », notes entre parenthèses retirées). */
export function appellationDeduite(vinTexte: string | null | undefined, appellationBase?: string | null) {
  if (appellationBase) return appellationCourte(appellationBase);
  return appellationCourte(propre(vinTexte).split(' – ')[0].replace(/\(.*?\)/g, ''));
}

/** Nom du vin lu sur la carte à l'import (partie après le tiret), sans guillemets ni notes. */
export function nomDeduit(vinTexte: string | null | undefined) {
  const n = propre(propre(vinTexte).split(' – ').slice(1).join(' – ').replace(/\(.*?\)/g, '').replace(/[«»"]/g, ''));
  return /non précisée|à préciser/i.test(n) ? '' : n;
}
