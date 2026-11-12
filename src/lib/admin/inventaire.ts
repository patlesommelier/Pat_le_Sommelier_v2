// Ancienneté du dernier inventaire d'un restaurant (tableau de bord, page Inventaire).

/** Jours entiers depuis une date (0 = aujourd'hui). */
export const joursDepuis = (d: string | Date) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

/** « aujourd'hui », « hier », « il y a 9 jours ». */
export function ilYA(d: string | Date) {
  const n = joursDepuis(d);
  return n <= 0 ? 'aujourd’hui' : n === 1 ? 'hier' : `il y a ${n} jours`;
}

/** Jours entre deux inventaires selon la fréquence choisie dans les Paramètres (7 sans rappel choisi). */
export const JOURS_PAR_FREQUENCE: Record<string, number> = { semaine: 7, '2semaines': 14, mois: 31 };

/** L'inventaire est à refaire : jamais fait, ou plus vieux que la fréquence choisie (7 jours par défaut). */
export const inventaireARefaire = (d: string | Date | null | undefined, frequence?: string | null) =>
  !d || joursDepuis(d) > (JOURS_PAR_FREQUENCE[frequence ?? ''] ?? 7);
