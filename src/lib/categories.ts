// Catégories spéciales de la carte (app et carte des vins du restaurant), en plus des couleurs.
// « Coups de cœur » : toujours, dès qu'un vin est coché ; « Nature » et « Bio » : si le restaurant les a choisies (Apparence).
// Un vin d'une catégorie spéciale n'apparaît que là (plus dans sa couleur) ; s'il est dans plusieurs, la première l'emporte.
// Sans dépendance serveur : utilisé par l'app (navigateur) et par le back-office.

export type VinCategorie = { couleur: string; coup_de_coeur?: boolean | null; nature?: boolean | null; bio?: boolean | null };

export const CATEGORIES_SPECIALES = [
  { id: 'coups_de_coeur', libelle: 'Coups de cœur', garde: (v: VinCategorie) => Boolean(v.coup_de_coeur) },
  { id: 'nature', libelle: 'Nature', garde: (v: VinCategorie) => Boolean(v.nature) },
  { id: 'bio', libelle: 'Bio', garde: (v: VinCategorie) => Boolean(v.bio) },
] as const;

/** Catégories spéciales en service pour ce restaurant (coups de cœur toujours ; nature, bio si choisies). */
export const categoriesActives = (choisies: readonly string[] | null | undefined) =>
  CATEGORIES_SPECIALES.filter((c) => c.id === 'coups_de_coeur' || (choisies ?? []).includes(c.id));

/** Onglet où le vin apparaît : sa catégorie spéciale (la première), sinon sa couleur. */
export function placeDansCarte(v: VinCategorie, actives: readonly { id: string; garde: (v: VinCategorie) => boolean }[]) {
  return actives.find((c) => c.garde(v))?.id ?? v.couleur;
}
