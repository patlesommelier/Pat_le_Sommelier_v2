import type { Motif, Reglages, Retenu, Candidat } from '../selection';

/** Phrase courte pour le restaurant : pourquoi ce vin est retenu (ou non). */
export function pourquoiRetenu(r: Retenu, rang: number, liste: Retenu[]): string {
  const m: Record<Motif, string> = {
    classement: rang === 1 ? 'Meilleur score' : 'Parmi les meilleurs scores',
    quatrieme_cinquieme: `${rang}e vin : bien noté et proche du 3e`,
    plus_cher: 'Vin d’exception : nettement plus cher que la liste',
    moins_cher: 'Vin plus accessible : nettement moins cher',
    tour_suivant: 'Proposé si le client demande autre chose',
  };
  const precedent = liste[rang - 2];
  if (r.motif === 'classement' && precedent && precedent.score === r.score) {
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
