// Présentation d'un producteur montrée au restaurant : le texte de la base de Quid Vinum, sans ce qui est réservé à Pat.
// Le texte s'arrête avant toute mention de Pat (« Profil Pat — iconique », ses convictions…), les phrases qui parlent
// de note, d'étoiles ou de classement sont retirées, et le gras écrit en Markdown (**…**) disparaît.

const INTERNE = /ranking|classement|class[ée]e?s?(?!\p{L})|\/\s*5(?!\d)|[ée]toiles?|(?<!\p{L})not[ée]e?s?\s+(sur|de)(?!\p{L})/iu;

export function presentationPublique(texte: string | null | undefined): string[] {
  if (!texte) return [];
  const coupe = texte.search(/\bPat\b/);
  // La phrase où Pat apparaît est retirée en entier (« **Profil Pat — iconique** : … »).
  const avant = (coupe >= 0 ? texte.slice(0, coupe).replace(/[^.!?\n]*$/, '') : texte).replace(/\*\*/g, '');
  return avant.split(/\n\s*\n/)
    .map((par) => (par.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [par]).filter((ph) => !INTERNE.test(ph)).join('').trim())
    .filter((par) => par.length > 20);
}
