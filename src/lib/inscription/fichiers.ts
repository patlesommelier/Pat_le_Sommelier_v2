// Contrôle des fichiers envoyés (menu, carte, logo) avant tout stockage ou analyse.
export const LIMITES = {
  menu: { types: ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'], maxFichiers: 8, maxOctets: 5 * 1024 * 1024 },
  carte: { types: ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'], maxFichiers: 12, maxOctets: 5 * 1024 * 1024 },
  logo: { types: ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'], maxFichiers: 1, maxOctets: 2 * 1024 * 1024 },
} as const;

export type TypeEnvoi = keyof typeof LIMITES;
export const TOTAL_MAX = 5.5 * 1024 * 1024;

// Signatures binaires : on ne se fie pas au type annoncé par le navigateur.
export function typeReel(octets: Uint8Array): string | null {
  const commence = (...sig: number[]) => sig.every((v, i) => octets[i] === v);
  if (commence(0x25, 0x50, 0x44, 0x46)) return 'application/pdf';
  if (commence(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (commence(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (commence(0x52, 0x49, 0x46, 0x46) && octets[8] === 0x57 && octets[9] === 0x45) return 'image/webp';
  if (String.fromCharCode(...octets.slice(4, 12)).includes('ftyp')) return 'image/heic';
  const debut = new TextDecoder().decode(octets.slice(0, 256)).trimStart();
  if (debut.startsWith('<svg') || (debut.startsWith('<?xml') && debut.includes('<svg'))) return 'image/svg+xml';
  return null;
}

export function verifierFichiers(type: TypeEnvoi, fichiers: Array<{ nom: string; octets: Uint8Array }>): string[] {
  const l = LIMITES[type];
  const erreurs: string[] = [];
  if (fichiers.length === 0) erreurs.push('Aucun fichier.');
  if (fichiers.length > l.maxFichiers) erreurs.push(`${l.maxFichiers} fichier(s) au maximum.`);
  // Un envoi passe par une fonction Netlify (6 Mo au plus par requête) : au-delà, envoyer les pages en plusieurs fois.
  if (fichiers.reduce((n, f) => n + f.octets.length, 0) > TOTAL_MAX) erreurs.push('Envoi trop lourd : envoyez les pages en plusieurs fois (elles s’ajoutent).');
  for (const f of fichiers) {
    if (f.octets.length > l.maxOctets) erreurs.push(`${f.nom} : ${Math.round(l.maxOctets / 1024 / 1024)} Mo au maximum.`);
    const t = typeReel(f.octets);
    if (!t || !(l.types as readonly string[]).includes(t)) erreurs.push(`${f.nom} : format non accepté.`);
    if (t === 'image/svg+xml' && /<script|on\w+\s*=|javascript:/i.test(new TextDecoder().decode(f.octets))) {
      erreurs.push(`${f.nom} : le SVG contient du code ; envoyez un PNG.`);
    }
  }
  return erreurs;
}
