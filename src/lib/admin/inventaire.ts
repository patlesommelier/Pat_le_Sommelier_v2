// Ancienneté du dernier inventaire d'un restaurant (tableau de bord, page Inventaire).

/** Jours entiers depuis une date (0 = aujourd'hui). */
export const joursDepuis = (d: string | Date) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

/** « aujourd'hui », « hier », « il y a 9 jours ». */
export function ilYA(d: string | Date) {
  const n = joursDepuis(d);
  return n <= 0 ? 'aujourd’hui' : n === 1 ? 'hier' : `il y a ${n} jours`;
}

/** L'inventaire est à refaire : jamais fait, ou plus de 7 jours. */
export const inventaireARefaire = (d: string | Date | null | undefined) => !d || joursDepuis(d) > 7;
