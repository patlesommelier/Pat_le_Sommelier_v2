// Identifiant d'URL d'un restaurant inscrit (fonction pure, testable).
/** Identifiant d'URL lisible et stable : « lola », « happys-kitchen-club », puis « lola-2 » si déjà pris. */
export function slugRestaurant(nom: string, existants: Set<string>) {
  const base = nom.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'restaurant';
  // Mots réservés par les adresses de l'app.
  const pris = (s: string) => existants.has(s) || ['admin', 'api', 'auth', 'inscription', 'pat', 'restaurants', 'uploads'].includes(s);
  if (!pris(base)) return base;
  for (let i = 2; ; i++) if (!pris(`${base}-${i}`)) return `${base}-${i}`;
}
