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
