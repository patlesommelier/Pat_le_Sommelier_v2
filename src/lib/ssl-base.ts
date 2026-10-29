// Chiffrement (SSL) de la connexion à la base : Supabase l'exige ; une base locale, ou interne au serveur
// (Postgres de Coolify, joint par un nom de conteneur sans point), n'en a pas. `sslmode=disable` dans l'adresse le coupe aussi.
// Sans « server-only » : utilisé aussi par les scripts et les fonctions Netlify.
export function sslBase(url: string | undefined) {
  const u = url ?? '';
  if (/sslmode=disable|localhost|127\.0\.0\.1|\/tmp/.test(u)) return false;
  const hote = /@([^/:?]+)/.exec(u)?.[1] ?? '';
  if (hote && !hote.includes('.')) return false;
  return { rejectUnauthorized: false };
}
