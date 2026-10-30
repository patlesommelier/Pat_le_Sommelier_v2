// Mots de passe et jetons des comptes, sans dépendance (scrypt de Node).
// Sans « server-only » : utilisé aussi par le script « creer-compte ».
import { createHash, randomBytes, scrypt as scryptRappel, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (mdp: string, sel: Buffer, options: ScryptOptions) => new Promise<Buffer>((ok, ko) =>
  scryptRappel(mdp.normalize('NFKC'), sel, 64, options, (e, cle) => (e ? ko(e) : ok(cle))));
const REGLAGES = { N: 16384, r: 8, p: 1 };

/** Empreinte d'un mot de passe : « scrypt$N$r$p$sel$empreinte » (base64url). */
export async function hacherMotDePasse(mdp: string): Promise<string> {
  const sel = randomBytes(16);
  const cle = await scrypt(mdp, sel, REGLAGES);
  return ['scrypt', REGLAGES.N, REGLAGES.r, REGLAGES.p, sel.toString('base64url'), cle.toString('base64url')].join('$');
}

/** Le mot de passe correspond-il à l'empreinte ? (comparaison à temps constant) */
export async function verifierMotDePasse(mdp: string, empreinte: string | null | undefined): Promise<boolean> {
  const [algo, N, r, p, sel, attendu] = (empreinte ?? '').split('$');
  if (algo !== 'scrypt' || !sel || !attendu) return false;
  const cible = Buffer.from(attendu, 'base64url');
  const cle = await scrypt(mdp, Buffer.from(sel, 'base64url'), { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return cle.length === cible.length && timingSafeEqual(cle, cible);
}

/** Jeton aléatoire (cookie de session, lien envoyé par e-mail). */
export const nouveauJeton = () => randomBytes(32).toString('base64url');
/** Ce que la base garde d'un jeton : son empreinte, jamais le jeton lui-même. */
export const empreinteJeton = (jeton: string) => createHash('sha256').update(jeton).digest('hex');
