// États affichés pour un vin de la carte (liste et fiche du back-office).
import type { VinBO } from '@/lib/admin/donnees';
import { etatEtiquetteVin } from '@/lib/etiquettes/etat';
import { contenanceDuFormat, grouperMemeVin, libelleCourt, ordonner } from '@/lib/contenances';
import { titreCarte } from '@/lib/admin/intitule';

type Etat = [string, 'ok' | 'propose' | 'attention' | ''];

export const etatEtiquette = (v: VinBO): Etat => etatEtiquetteVin(v);

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
