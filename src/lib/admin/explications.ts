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
    return precedent.note > r.note ? 'Même score, note un peu plus basse' : 'Même score : départagé (diversité, rankings, ordre de la carte)';
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
