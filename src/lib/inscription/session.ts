// Session d'inscription anonyme : le restaurateur avance dans les étapes avant d'avoir un compte.
// Un jeton aléatoire est posé en cookie httpOnly ; seule son empreinte SHA-256 est stockée en base.
import { createHash, randomBytes } from 'node:crypto';

export const COOKIE = 'pat_inscription';
export const DUREE_HEURES = 48;

export function nouveauJeton() {
  const jeton = randomBytes(32).toString('base64url');
  return { jeton, empreinte: empreinte(jeton) };
}

export const empreinte = (jeton: string) => createHash('sha256').update(jeton).digest('hex');

export const optionsCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: DUREE_HEURES * 3600,
};

export const expireLe = (maintenant = new Date()) => new Date(maintenant.getTime() + DUREE_HEURES * 3600 * 1000);
