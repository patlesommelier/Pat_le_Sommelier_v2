// Texte « Le domaine » de la fiche d'un vin dans l'app : début de la fiche du producteur dans la base de Pat,
// pour les producteurs qu'il connaît bien et place haut (4 ou 5). Ce qui relève de la cuisine interne n'est jamais repris :
// le « Profil Pat » et ce qui suit, les prix, les notes de critiques, toute mention de ranking.
// La fiche complète reste réservée au super-admin.

const LONGUEUR = 1100; // caractères au plus (environ 8 lignes sur un téléphone)
const INTERNE = /€|\bscores?\b|\d+\s*\/\s*(20|100)\b|\branking|\bPat\b|\bLPV\b|\bRVF\b|Parker|Suckling|\bpoints?\b|\bprix\b|\btarifs?\b|ranking_|niveau_reference/i;

/** Extrait publiable de la fiche (texte simple, sans mise en forme), ou null s'il est trop court. */
export function extraitFiche(fiche: string | null | undefined): string | null {
  if (!fiche) return null;
  const debut = fiche.split(/\*{0,2}\s*Profil Pat\b/i)[0];
  const texte = debut.replace(/\*\*|__|(?<!\w)[*_](?!\s)|(?<!\s)[*_](?!\w)/g, '').replace(/\s+/g, ' ').trim();
  const phrases = texte.split(/(?<=[.!?…])\s+(?=[«"A-ZÀ-ÖØ-Þ0-9(])/);
  let extrait = '';
  for (const p of phrases) {
    if (INTERNE.test(p)) continue;
    if ((extrait + ' ' + p).trim().length > LONGUEUR) break;
    extrait = (extrait + ' ' + p).trim();
  }
  return extrait.length >= 200 ? extrait : null;
}
