// Regroupement des distributeurs saisis par les restaurants (« Licata », « LICATA SA », « Licata s.a. » = le même).
/** Clé de regroupement d'un nom de distributeur : minuscules, sans accents, sans forme de société ni ponctuation. */
export function cleDistributeur(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b(s\.?a\.?|s\.?r\.?l\.?|s\.?p\.?r\.?l\.?|b\.?v\.?|n\.?v\.?|s\.?c\.?o\.?m\.?m\.?|scs|sas|sarl|bvba|gmbh|ltd|srl|sprl)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
