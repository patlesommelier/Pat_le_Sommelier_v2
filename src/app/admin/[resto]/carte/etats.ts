// États affichés pour un vin de la carte (liste et fiche du back-office).
import type { VinBO } from '@/lib/admin/donnees';

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
// Un même vin en plusieurs contenances (bouteille, demi…) est enregistré une fois par contenance :
// la liste le montre sur une seule ligne. Le prix au verre est une contenance de plus.

const CONTENANCES = ['Magnum', 'Bouteille', '½', '¼', 'Verre'] as const;

export function contenance(format: string) {
  const f = format.replace(/\s+/g, '').toLowerCase();
  if (/verre/.test(f)) return 'Verre';
  const cl = Number(f.replace(',', '.').replace(/cl$/, ''));
  if (cl >= 140) return 'Magnum';
  if (cl >= 70) return 'Bouteille';
  if (cl >= 35) return '½';
  if (cl >= 18) return '¼';
  return format;
}

const cleVin = (v: VinBO) => [v.couleur, v.libelle.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), v.millesime ?? ''].join('|');

export interface GroupeVin {
  /** Ligne ouverte par « Modifier » : la bouteille, sinon la première contenance de la carte. */
  principal: VinBO;
  tous: VinBO[];
  /** Contenances disponibles, de la plus grande au verre. */
  contenances: string[];
  /** Prix affiché : celui de la bouteille quand il y a plusieurs contenances. */
  prix: { montant: number; verre: boolean } | null;
}

export function regrouperVins(vins: VinBO[]): GroupeVin[] {
  const groupes = new Map<string, VinBO[]>();
  for (const v of vins) groupes.set(cleVin(v), [...(groupes.get(cleVin(v)) ?? []), v]);
  return [...groupes.values()].map((tous) => {
    const principal = tous.find((v) => contenance(v.format) === 'Bouteille') ?? tous[0];
    const dispo = tous.filter((v) => v.disponible);
    const vues = new Set(dispo.flatMap((v) => [contenance(v.format), ...(v.prix_verre ? ['Verre'] : [])]));
    const contenances = [...CONTENANCES.filter((c) => vues.has(c)), ...[...vues].filter((c) => !(CONTENANCES as readonly string[]).includes(c))];
    const prix = principal.prix ? { montant: principal.prix, verre: false }
      : principal.prix_verre ? { montant: principal.prix_verre, verre: true } : null;
    return { principal, tous, contenances, prix };
  });
}

/** Autres contenances du même vin (fiche du vin). */
export function autresContenances(vins: VinBO[], v: VinBO) {
  return vins.filter((x) => x.id !== v.id && cleVin(x) === cleVin(v));
}
