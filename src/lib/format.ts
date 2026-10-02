export const euros = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : `${n.toFixed(2).replace('.', ',')} €`;

/** « Henri Bourgeois · Sauvignon blanc · 2025 · 37,5 cl » */
export function sousTitreVin(v: { producteur_nom?: string | null; producteur_texte?: string | null; cepages?: string | null; millesime?: string | null; format?: string }, avecCepages = false) {
  const prod = (v.producteur_nom ?? v.producteur_texte ?? '').replace(/\s*\(.*\)/, '');
  const morceaux = [/^non /i.test(prod) ? '' : prod, avecCepages ? v.cepages ?? '' : '', v.millesime && v.millesime !== 'NM' ? v.millesime : '', v.format && v.format !== '75 cl' ? v.format : ''];
  return morceaux.filter(Boolean).join(' · ');
}
