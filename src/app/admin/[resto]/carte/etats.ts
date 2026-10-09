// États affichés pour un vin de la carte (liste et fiche du back-office).
import type { VinBO } from '@/lib/admin/donnees';
import { cleMemeVin, contenanceDuFormat, libelleCourt, ordonner } from '@/lib/contenances';

type Etat = [string, 'ok' | 'propose' | 'attention' | ''];

export function etatEtiquette(v: VinBO): Etat {
  if (v.etiquette_source === 'restaurant') return ['Votre photo', 'propose'];
  if (v.etiquette_source === 'wine_labs') return ['Wine Labs', 'ok'];
  if (v.etiquette_source === 'cuvee') return ['Base de Pat', 'ok'];
  if (v.etiquette_url) return ['Fournie', 'ok'];
  if (v.etiquette_statut === 'demandee' || v.etiquette_statut === 'a_demander') return ['Recherche Wine Labs…', ''];
  if (v.etiquette_statut === 'echec') return ['Échec Wine Labs : à photographier', 'attention'];
  if (v.etiquette_statut === 'introuvable') return ['Introuvable chez Wine Labs : à photographier', 'attention'];
  return ['À photographier', 'attention'];
}

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
  const groupes = new Map<string, VinBO[]>();
  for (const v of vins) groupes.set(cleMemeVin(v), [...(groupes.get(cleMemeVin(v)) ?? []), v]);
  return [...groupes.values()].map((tous) => {
    const principal = tous.find((v) => contenanceDuFormat(v.format) === 'bouteille') ?? tous[0];
    const dispo = tous.filter((v) => v.disponible);
    const contenances = dispo.length ? ordonner(dispo.flatMap((v) => v.contenances ?? [])).map(libelleCourt) : [];
    const prix = principal.prix ? { montant: principal.prix, verre: false }
      : principal.prix_verre ? { montant: principal.prix_verre, verre: true } : null;
    return { principal, tous, contenances, prix };
  });
}

/** Autres lignes du même vin (fiche du vin) : une par contenance qui a son propre prix. */
export function autresContenances(vins: VinBO[], v: VinBO) {
  return vins.filter((x) => x.id !== v.id && cleMemeVin(x) === cleMemeVin(v));
}
