// Petite appréciation de Pat, à la première personne, ajoutée au commentaire d'accord montré au client :
// plus la note est haute, plus elle est enthousiaste. Elle varie d'un accord à l'autre (choisie selon le plat et la position du vin dans la liste),
// et n'est jamais ajoutée à un commentaire écrit par le restaurant.
// Voix de Pat : vouvoiement, chaleureux, humour pince-sans-rire glissé dans une incise, jamais appuyé
// (une formule sur deux environ ; les autres restent simples, pour que l'humour garde son effet).
const APPRECIATIONS: Record<number, string[]> = {
  5: [
    'c’est l’un de mes accords préférés, et je ne le dis pas à tout le monde', 'je le trouve remarquable',
    'je vous le recommande les yeux fermés, mais gardez-les ouverts pour le goûter', 'j’adore cet accord',
    'pour moi, c’est un mariage parfait, sans même passer par la mairie', 'je ne m’en lasse pas, et pourtant j’ai essayé',
  ],
  4: [
    'je trouve l’accord très réussi', 'j’aime beaucoup cet accord, et mon verre aussi', 'je le trouve très juste',
    'je vous le conseille volontiers, sans toucher la moindre commission', 'c’est un accord que j’apprécie beaucoup',
    'je trouve qu’ils vont très bien ensemble, comme un vieux couple qui ne se dispute presque jamais',
  ],
  3: [
    'je le trouve agréable', 'c’est un choix que j’aime bien, sans faire de vagues', 'je le trouve harmonieux',
    'un accord que je trouve plaisant, sans esbroufe', 'je le trouve bien équilibré, ce qui est déjà plus que moi un lundi matin',
  ],
};

const hash = (t: string) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * « Pétillant et sec, le Cava tranche le gras de la friture. » (note 4)
 *   → « Pétillant et sec, le Cava tranche le gras de la friture, je trouve l’accord très réussi. »
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
