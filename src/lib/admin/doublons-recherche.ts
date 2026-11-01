// Recherche d'un vin (ajout) : un vin d'une carte de restaurant pas encore relié à la base (« Molino a Vento Nero d'Avola Bio »,
// producteur écrit « Orestadi ») est souvent le même qu'un vin de la base (« Nero d'Avola Bio » de Molino a Vento) : il n'est
// alors pas proposé une deuxième fois.
const VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'en', 'au', 'aux', 'a', 'the', 'di', 'del', 'della', 'y',
  'vin', 'cuvee', 'domaine', 'chateau', 'maison', 'aop', 'aoc', 'igp', 'doc', 'docg', 'tenuta', 'cantina', 'cantine']);
const mots = (t: string | null | undefined) => new Set(t ? t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .split(/[^a-z0-9]+/).filter((m) => m && !VIDES.has(m)) : []);
const inclus = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every((m) => b.has(m));

export type VinCompare = { libelle: string; producteur: string | null; couleur: string | null };

/** Vrai si le vin de la carte (non relié) décrit le même vin que celui de la base : mêmes mots, producteur compris d'un côté ou de l'autre. */
export function memeVinQue(carte: VinCompare, base: VinCompare): boolean {
  if (carte.couleur && base.couleur && carte.couleur !== base.couleur) return false;
  const carteNom = mots(carte.libelle), baseNom = mots(base.libelle);
  const carteTout = new Set([...carteNom, ...mots(carte.producteur)]), baseTout = new Set([...baseNom, ...mots(base.producteur)]);
  return inclus(carteNom, baseTout) && inclus(baseNom, carteTout);
}
