// États affichés pour un vin de la carte (liste et fiche du back-office).
import type { VinBO } from '@/lib/admin/donnees';
import { categoriesActives, placeDansCarte } from '@/lib/categories';
import { etatEtiquetteRestaurant } from '@/lib/etiquettes/etat';
import { contenanceDuFormat, grouperMemeVin, libelleCourt, ordonner } from '@/lib/contenances';
import { titreCarte } from '@/lib/admin/intitule';

type Etat = [string, 'ok' | 'propose' | 'attention' | ''];

export const etatEtiquette = (v: VinBO, fiche = false): Etat => etatEtiquetteRestaurant(v, fiche);

export function etatProducteur(v: VinBO): Etat {
  // Les rankings de Pat restent internes : le restaurant voit seulement si le producteur est déjà référencé ou nouveau.
  if (v.statut_producteur === 'nouveau') return ['Nouveau producteur', 'propose'];
  if (v.statut_producteur === 'reference') return ['Déjà référencé', 'ok'];
  if (v.producteur_texte && !/^non /i.test(v.producteur_texte)) return ['À relier : choisir le producteur', 'attention'];
  return ['Producteur à préciser', 'attention'];
}

// ───────── Contenances ─────────
// Un même vin en plusieurs contenances peut être enregistré une fois par contenance (une ligne par prix) :
// la liste le montre sur une seule ligne, avec les contenances cochées dans sa fiche.

export interface GroupeVin {
  /** Ligne ouverte par « Modifier » : la bouteille, sinon la première contenance de la carte. */
  principal: VinBO;
  tous: VinBO[];
  /** Contenances disponibles (libellés courts), dans l'ordre des cases de la fiche. */
  contenances: string[];
  /** Prix affiché : celui de la bouteille quand il y a plusieurs contenances. */
  prix: { montant: number; verre: boolean } | null;
}

export function regrouperVins(vins: VinBO[]): GroupeVin[] {
  return grouperMemeVin(vins, (v) => v.format).map((tous) => {
    const principal = tous.find((v) => contenanceDuFormat(v.format) === 'bouteille') ?? tous[0];
    const dispo = tous.filter((v) => v.disponible);
    const contenances = dispo.length ? ordonner(dispo.flatMap((v) => v.contenances ?? [])).map(libelleCourt) : [];
    const prix = principal.prix ? { montant: principal.prix, verre: false }
      : principal.prix_verre ? { montant: principal.prix_verre, verre: true } : null;
    return { principal, tous, contenances, prix };
  });
}

/** Onglet d'un vin (toutes contenances) : sa catégorie spéciale (coup de cœur, nature, bio), sinon sa couleur — comme dans l'app. */
export function placeGroupe(g: GroupeVin, actives: ReturnType<typeof categoriesActives>) {
  const dispo = g.tous.filter((x) => x.disponible);
  const auVerre = dispo.some((x) => contenanceDuFormat(x.format) === 'verre' || x.prix_verre != null);
  return placeDansCarte({ couleur: g.principal.couleur, coup_de_coeur: g.tous.some((x) => x.coup_de_coeur), nature: g.principal.nature, bio: g.principal.bio, au_verre: auVerre }, actives);
}

/**
 * Vins d'une couleur rangés par sous-catégorie (rubrique de la carte), comme dans l'app :
 * les rubriques dans l'ordre de leur premier vin, et les vins dans l'ordre de la carte.
 */
export function parRubrique(groupes: GroupeVin[]): { nom: string; groupes: GroupeVin[] }[] {
  const rubriques: { nom: string; groupes: GroupeVin[] }[] = [];
  for (const g of groupes) {
    const nom = g.principal.section ?? '';
    const r = rubriques.find((x) => x.nom === nom);
    if (r) r.groupes.push(g); else rubriques.push({ nom, groupes: [g] });
  }
  return rubriques;
}

/** Autres lignes du même vin (fiche du vin) : une par contenance qui a son propre prix. */
export function autresContenances(vins: VinBO[], v: VinBO) {
  return (grouperMemeVin(vins, (x) => x.format).find((g) => g.includes(v)) ?? []).filter((x) => x.id !== v.id);
}

/**
 * Nom du vin dans la liste du back-office : le même que dans l'app (nom du vin en gras, puis producteur et appellation),
 * sans le millésime ni les cépages, qui ont leur colonne.
 */
export function nomPourListe(v: VinBO): string[] {
  const producteur = v.producteur_texte && !/^non /i.test(v.producteur_texte) ? v.producteur_texte : v.producteur_nom;
  const { titre, sousTitre } = titreCarte({ ...v, producteur }, { millesime: false, cepages: false });
  return [titre, ...(sousTitre ? [sousTitre] : [])];
}
