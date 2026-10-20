// Recherche d'un accord de référence à partir de ce que l'utilisateur écrit à Pat (« un magret de canard aux cerises »).
// Fonction pure, testable : les mots de la question sont comparés au nom du plat, à ses variantes et à sa sous-famille.

export interface AccordReference {
  id: string; nom: string; famille: string | null; sous_famille: string | null; variantes: string | null;
  vins_recommandes: string | null; producteurs_phares: string | null; alternative_accessible: string | null;
  justification_charnelle: string | null; notes_pratiques: string | null;
  axe_diversite_2: Axe | null; axe_diversite_3: Axe | null;
}
export type Axe = { categorie_vin: string; vins_recommandes: string; mecanique_accord: string; justification_courte: string };

const VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'un', 'une', 'et', 'ou', 'en', 'au', 'aux', 'a', 'avec', 'sur', 'pour', 'sans',
  'je', 'j', 'tu', 'mange', 'manger', 'mangeons', 'mangerai', 'ce', 'soir', 'midi', 'que', 'quoi', 'quel', 'quels', 'quelle', 'boire', 'vin', 'vins',
  'conseilles', 'conseille', 'conseiller', 'me', 'moi', 'nous', 'on', 'prends', 'prendre', 'fais', 'fait', 'cuisine', 'plat', 'servir', 'sers',
  'est', 'c', 'qu', 'il', 'y', 'mon', 'ma', 'mes', 'notre', 'nos', 'bon', 'bonne', 'peux', 'peut', 'aide', 'aider', 'ai', 'avons', 'dois', 'faut']);

/** Mots utiles d'un texte : sans accents, en minuscules, au singulier (approximatif), sans les mots vides. */
export function motsUtiles(t: string | null | undefined) {
  return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe')
    .split(/[^a-z0-9]+/).filter((m) => m.length > 1 && !VIDES.has(m)).map((m) => (m.length > 3 ? m.replace(/(s|x)$/, '') : m));
}

/** Les accords qui correspondent le mieux à la question, du plus proche au moins proche (au plus `n`). */
export function trouverAccords<T extends Pick<AccordReference, 'nom' | 'variantes' | 'sous_famille' | 'famille'>>(question: string, accords: T[], n = 3): T[] {
  const q = new Set(motsUtiles(question));
  if (!q.size) return [];
  const note = (a: T) => {
    const nom = motsUtiles(a.nom), variantes = motsUtiles(a.variantes), sous = motsUtiles(a.sous_famille);
    const communs = (l: string[]) => [...new Set(l)].filter((m) => q.has(m)).length;
    // Le nom compte le plus ; un nom entièrement retrouvé dans la question passe devant.
    const nomCommuns = communs(nom);
    return nomCommuns * 10 + (nom.length && nomCommuns === new Set(nom).size ? 5 : 0) + communs(variantes) * 3 + communs(sous);
  };
  return accords.map((a) => ({ a, s: note(a) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, n).map((x) => x.a);
}
