export const euros = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : `${n.toFixed(2).replace('.', ',')} €`;

/** « Henri Bourgeois · Sauvignon blanc · 2025 · 37,5 cl » */
export function sousTitreVin(v: { producteur_nom?: string | null; producteur_texte?: string | null; cepages?: string | null; millesime?: string | null; format?: string }, avecCepages = false) {
  const prod = (v.producteur_nom ?? v.producteur_texte ?? '').replace(/\s*\(.*\)/, '');
  const morceaux = [/^non /i.test(prod) ? '' : prod, avecCepages ? v.cepages ?? '' : '', v.millesime && v.millesime !== 'NM' ? v.millesime : '', v.format && v.format !== '75 cl' ? v.format : ''];
  return morceaux.filter(Boolean).join(' · ');
}

/** Prix des contenances en une ligne courte : « 175 € · ½ 91 € · verre 25 € ». */
export function lignePrix(tarifs: Array<{ code: string; prix: number }>) {
  const court: Record<string, string> = { bouteille: '', demi: '½ ', quart: '¼ ', magnum: 'magnum ', verre: 'verre ' };
  return tarifs.map((t) => `${court[t.code] ?? ''}${euros(t.prix)}`).join(' · ');
}

/** Mention d'un contenant (bouteille, demi, quart, magnum, verre, centilitres) : les contenances sont affichées à part. */
export const CONTENANT = /\b(demi-bouteilles?|demi bouteilles?|bouteilles?|magnums?|quarts? de bouteille|au verre|\d+(,\d+)?\s?cl)\b|½|¼/i;

/**
 * Présentation d'un vin sans les phrases qui parlent du contenant (« La demi-bouteille garde tout l'élan… ») :
 * la contenance et son prix sont indiqués en dessous. Si presque rien ne reste, le texte est gardé tel quel.
 */
export function sansContenance<T extends string | null | undefined>(texte: T): T {
  if (!texte || !CONTENANT.test(texte)) return texte;
  const phrases = texte.match(/[^.!?…]+[.!?…]+[»”"]?\s*|[^.!?…]+$/g) ?? [texte];
  const reste = phrases.filter((p) => !CONTENANT.test(p)).join('').trim();
  return (reste.length >= 60 ? reste : texte) as T;
}
