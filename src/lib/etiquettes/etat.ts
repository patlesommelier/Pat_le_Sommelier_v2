// État de l'étiquette d'un vin, tel que le back-office l'affiche (source de la photo, ou recherche Wine Labs).
// Sans dépendance serveur.

export type EtatEtiquette = [string, 'ok' | 'propose' | 'attention' | ''];

/** Étiquette d'un vin d'une carte de restaurant (« Votre photo » dans l'espace du restaurant, « Photo du restaurant » pour Pat). */
export function etatEtiquetteVin(v: { etiquette_url: string | null; etiquette_source: string | null; etiquette_statut: string | null; etiquette_erreur?: string | null }, pourPat = false): EtatEtiquette {
  if (v.etiquette_source === 'restaurant') return [pourPat ? 'Photo du restaurant' : 'Votre photo', 'propose'];
  if (v.etiquette_source === 'wine_labs') return ['Wine Labs', 'ok'];
  if (v.etiquette_source === 'cuvee') return ['Base de Pat', 'ok'];
  if (v.etiquette_url) return ['Fournie', 'ok'];
  if (v.etiquette_statut === 'demandee' || v.etiquette_statut === 'a_demander') return ['Recherche Wine Labs…', ''];
  if (v.etiquette_statut === 'echec') return ['Échec Wine Labs : à photographier', 'attention'];
  // Pas demandé à Wine Labs faute de producteur (il ne pourrait pas reconnaître le vin).
  if (v.etiquette_statut === 'introuvable' && v.etiquette_erreur?.startsWith('Producteur inconnu')) return ['Producteur à préciser, ou à photographier', 'attention'];
  if (v.etiquette_statut === 'introuvable') return ['Introuvable chez Wine Labs : à photographier', 'attention'];
  return ['À photographier', 'attention'];
}

/**
 * Étiquette d'un vin vue par le restaurant : sans rien de la cuisine interne (Wine Labs, échecs, crédits).
 * Photo de Wine Labs, de la base ou fournie par Pat : « Base de Pat » ; sans photo : Pat la cherche.
 * Dans la fiche du vin (`fiche`), on l'invite à envoyer sa propre photo.
 */
export function etatEtiquetteRestaurant(v: { etiquette_url: string | null; etiquette_source: string | null; etiquette_statut: string | null; etiquette_erreur?: string | null }, fiche = false): EtatEtiquette {
  if (v.etiquette_source === 'restaurant') return ['Votre photo', 'propose'];
  if (v.etiquette_url) return ['Base de Pat', 'ok'];
  // Pas de recherche possible sans producteur : le restaurant peut le préciser.
  if (v.etiquette_statut === 'introuvable' && v.etiquette_erreur?.startsWith('Producteur inconnu')) return ['Producteur à préciser, ou à photographier', 'attention'];
  return fiche ? ['Pat la cherche, uploadez votre photo si vous préférez', ''] : ['Pat est en train de la chercher', ''];
}

/**
 * Étiquette d'un vin de la base : sa photo et d'où elle vient ; sans photo, l'état des recherches Wine Labs
 * de ses vins sur les cartes (en cours d'abord, puis échec, introuvable).
 */
export function etatEtiquetteBase(c: { etiquette_url: string | null; etiquette_source: string | null; statuts_cartes?: string[] | null }): EtatEtiquette {
  if (c.etiquette_url) {
    if (c.etiquette_source === 'wine_labs') return ['Wine Labs', 'ok'];
    if (c.etiquette_source === 'restaurant') return ['Photo d’un restaurant', 'propose'];
    return ['Fournie', 'ok'];
  }
  const s = new Set(c.statuts_cartes ?? []);
  if (s.has('demandee') || s.has('a_demander')) return ['Recherche Wine Labs…', ''];
  if (s.has('echec')) return ['Échec Wine Labs', 'attention'];
  if (s.has('introuvable')) return ['Introuvable chez Wine Labs', 'attention'];
  return ['Sans étiquette', 'attention'];
}
