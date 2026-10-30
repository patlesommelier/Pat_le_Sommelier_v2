// Deux adresses pour un même site : l'espace des restaurateurs (URL_ADMIN, quidvinum.com : inscription, espace restaurant,
// super-admin) et les apps des clients (URL_PUBLIQUE, patlesommelier.com : /<restaurant>, /pat, QR codes).
// Sans URL_ADMIN, tout reste sur une seule adresse.

export type Cote = 'admin' | 'client' | 'commun';

/** Côté d'une page : « commun » pour ce qui sert aux deux (API, liens de connexion, conditions, fichiers). */
export function cote(chemin: string): Cote {
  if (chemin === '/' || /^\/admin(\/|$)/.test(chemin)) return 'admin';
  if (/^\/(api|connexion|conditions|uploads|_next)(\/|$)/.test(chemin) || /^\/\./.test(chemin) || /\.[a-z0-9]+$/i.test(chemin)) return 'commun';
  return 'client'; // /pat et /<restaurant>
}

const hote = (url: string | undefined) => { try { return url ? new URL(url).host : null; } catch { return null; } };

/**
 * Adresse vers laquelle renvoyer cette page, ou null si elle est déjà au bon endroit. Les adresses qui ne sont ni l'une
 * ni l'autre (essai, développement) ne sont jamais renvoyées ; « www. » renvoie vers l'adresse sans « www. ».
 */
export function redirectionDomaine(host: string, chemin: string, env: Record<string, string | undefined> = process.env): string | null {
  const admin = env.URL_ADMIN?.trim().replace(/\/$/, ''), client = env.URL_PUBLIQUE?.trim().replace(/\/$/, '');
  const [ha, hc] = [hote(admin), hote(client)];
  if (!admin || !client || !ha || !hc || ha === hc) return null;
  const h = host.toLowerCase().replace(/^www\./, '');
  if (h !== ha && h !== hc) return null;
  const c = cote(chemin);
  const cible = c === 'admin' ? admin : c === 'client' ? client : h === ha ? admin : client;
  return host.toLowerCase() === hote(cible) ? null : cible;
}

/** Adresse du site pour une page donnée (liens envoyés par e-mail) : côté restaurateurs ou côté clients. */
export function adressePour(chemin: string, env: Record<string, string | undefined> = process.env): string | null {
  const admin = env.URL_ADMIN?.trim().replace(/\/$/, ''), client = env.URL_PUBLIQUE?.trim().replace(/\/$/, '');
  return (cote(chemin) === 'admin' ? admin || client : client) || null;
}
