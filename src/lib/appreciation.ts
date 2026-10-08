// Petite appréciation ajoutée au commentaire d'accord montré au client : plus la note est haute, plus elle est
// enthousiaste. Elle varie d'un accord à l'autre (choisie selon le plat et la position du vin dans la liste),
// et n'est jamais ajoutée à un commentaire écrit par le restaurant.
const APPRECIATIONS: Record<number, string[]> = {
  5: [
    'c’est un accord remarquable', 'un accord de toute beauté', 'un mariage vraiment réussi',
    'je vous le recommande les yeux fermés', 'un accord qui fait mouche', 'un accord exceptionnel',
  ],
  4: [
    'c’est un très joli accord', 'un bel accord', 'un accord très réussi', 'un très bon choix pour ce plat',
    'un accord qui fonctionne très bien', 'une très belle association',
  ],
  3: ['un accord agréable', 'un choix sûr', 'une association plaisante', 'un accord harmonieux', 'un accord tout en équilibre'],
};

const hash = (t: string) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * « Pétillant et sec, le Cava tranche le gras de la friture. » (note 4)
 *   → « Pétillant et sec, le Cava tranche le gras de la friture, c’est un très joli accord. »
 * `cle` (le plat, en général) et `position` (rang du vin dans la liste) font varier la formule.
 */
export function avecAppreciation(texte: string | null | undefined, note: number | null | undefined,
  { cle = '', position = 0, ecritParLeRestaurant = false }: { cle?: string; position?: number; ecritParLeRestaurant?: boolean } = {}): string | null {
  if (!texte) return texte ?? null;
  const liste = note ? APPRECIATIONS[Math.min(5, Math.round(note))] : undefined;
  if (!liste || ecritParLeRestaurant) return texte;
  const phrase = liste[(hash(cle) + position) % liste.length];
  const t = texte.trim();
  return /[.!…]$/.test(t) ? `${t.replace(/[.!…]+$/, '')}, ${phrase}.` : `${t}, ${phrase}.`;
}
