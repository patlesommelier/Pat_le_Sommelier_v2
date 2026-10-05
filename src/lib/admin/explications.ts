import type { Motif, Reglages, Retenu, Candidat } from '../selection';

/**
 * Phrase courte : pourquoi ce vin est retenu (ou non).
 * interne = vue de Pat (administrateur), qui peut parler de score ; sinon vue du restaurant, sans score ni ranking.
 */
export function pourquoiRetenu(r: Retenu, rang: number, liste: Retenu[], interne = false): string {
  const m: Record<Motif, string> = {
    classement: interne ? (rang === 1 ? 'Meilleur score' : 'Parmi les meilleurs scores') : (rang === 1 ? 'En tête du classement de Pat' : 'Parmi les premiers du classement de Pat'),
    quatrieme_cinquieme: interne ? `${rang}e vin : bien noté et proche du 3e` : `${rang}e vin : bien noté, il complète la liste`,
    plus_cher: 'Vin d’exception : nettement plus cher que la liste',
    moins_cher: 'Vin plus accessible : nettement moins cher',
    tour_suivant: 'Proposé si le client demande autre chose',
  };
  const precedent = liste[rang - 2];
  if (interne && r.motif === 'classement' && precedent && precedent.score === r.score) {
    return precedent.note > r.note ? 'Même score, note un peu plus basse' : 'Même score : départagé (diversité, ordre de la carte)';
  }
  return m[r.motif];
}

export function pourquoiPas(c: { note: number; score: number; vin: Candidat }, R: Reglages, liste: Retenu[], tour2: Set<string>): [string, 'defaut' | 'propose' | ''] {
  if (c.note <= R.noteEliminatoire) return [`Écarté : note ${c.note} (≤ ${R.noteEliminatoire})`, 'defaut'];
  if (tour2.has(c.vin.id)) return ['Tour 2 : si le client veut autre chose', 'propose'];
  const dernier = liste[liste.length - 1];
  if (dernier && c.note < R.noteMinAjout && c.score >= (dernier?.score ?? 0) - 1) return [`Note ${c.note} : il faut ${R.noteMinAjout} pour compléter la liste`, ''];
  return ['Plus loin dans le classement', ''];
}

/**
 * Raison exacte, règle par règle, pour laquelle un vin noté n'est pas dans la liste (vue super-admin : parle de score).
 * Reprend l'ordre de selectionner() : règles 10, 1, puis 3 à 5 (trois premiers), 11 (bulles), 9 (maximum), 6 (4e et 5e).
 */
export function raisonEcart(c: { note: number; score: number; vin: Candidat }, R: Reglages, sel: { liste: Retenu[]; classement: Retenu[] }, tour2: Set<string>): string {
  if (!sel.classement.some((r) => r.vin.id === c.vin.id)) {
    if (c.note <= R.noteEliminatoire) return `Règle 1 : note ${c.note}, les notes ≤ ${R.noteEliminatoire} sont écartées`;
    return 'Règle 10 : demi-bouteille d’un vin aussi proposé en 75 cl';
  }
  const suite = tour2.has(c.vin.id) ? ' — proposé au tour 2' : '';
  const liste = sel.liste;
  const bulles = liste.filter((r) => r.vin.couleur === 'bulles').length;
  if (c.vin.couleur === 'bulles' && bulles >= R.plafondBulles) return `Règle 11 : déjà ${bulles} bulles dans la liste (plafond ${R.plafondBulles})${suite}`;
  if (liste.length < R.premiers) return `Non retenu alors que la liste n’a que ${liste.length} vin(s) sur ${R.premiers} : départage${suite}`;
  if (liste.length >= R.maximum) return `Règle 9 : la liste est complète (${R.maximum} vins au plus)${suite}`;
  const troisieme = liste[R.premiers - 1];
  if (c.note < R.noteMinAjout) return `Règle 6 : un 4e ou 5e vin doit avoir une note ≥ ${R.noteMinAjout} (note ${c.note})${suite}`;
  if (troisieme && c.score < troisieme.score - 1) return `Règle 6 : score ${c.score}, trop loin du 3e vin (score ${troisieme.score}, il faut ≥ ${troisieme.score - 1})${suite}`;
  if (c.score < R.scoreMinAjout) return `Règle 6 : score ${c.score}, il faut ≥ ${R.scoreMinAjout} pour un 4e ou 5e vin${suite}`;
  return `Départage à score égal : diversité (couleur, pays, cépage, appellation) puis ranking et ordre de la carte${suite}`;
}

/** Libellés des réglages, pour afficher ceux en vigueur sur un restaurant. */
export const LIBELLES_REGLAGES: Record<keyof Reglages, string> = {
  contenance: 'Demi-bouteille écartée si le vin existe en 75 cl (règle 10)',
  noteEliminatoire: 'Notes écartées : jusqu’à (règle 1)',
  diversite: 'Diversité entre ex aequo (règle 3)',
  premiers: 'Nombre de premiers vins (règles 3 à 5)',
  maximum: 'Nombre maximal de vins (règle 9)',
  noteMinAjout: 'Note minimale d’un 4e ou 5e vin (règle 6)',
  scoreMinAjout: 'Score minimal d’un 4e ou 5e vin (règle 6)',
  plusCher: 'Vin plus cher (règle 7)',
  facteurPlusCher: 'Vin plus cher : au moins × le plus cher de la liste',
  moinsCher: 'Vin moins cher (règle 8)',
  ecartMoinsCher: 'Vin moins cher si l’écart de prix de la liste est sous ×',
  plafondBulles: 'Bulles au plus (règle 11)',
  tourSuivant: 'Vins proposés au tour 2',
};
