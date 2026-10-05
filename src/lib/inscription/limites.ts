// Limite les inscriptions par adresse IP : la lecture du menu et de la carte coûte des appels au modèle,
// avant même que l'e-mail soit confirmé.
import 'server-only';
import { createHash } from 'node:crypto';
import { requete } from '../db';

export const MAX_PAR_IP_ET_JOUR = 5;
export const MAX_ANALYSES_PAR_INSCRIPTION = 6; // menu + carte, renvois compris

export const empreinteIp = (ip: string) =>
  createHash('sha256').update(`${process.env.INSCRIPTION_SEL ?? ''}:${ip}`).digest('hex');

export async function inscriptionAutorisee(ip: string): Promise<boolean> {
  const e = empreinteIp(ip);
  const [{ n }] = await requete<{ n: number }>(
    `select count(*)::int as n from inscription_tentative where ip_empreinte = $1 and cree_le > now() - interval '1 day'`, [e]);
  if (n >= MAX_PAR_IP_ET_JOUR) return false;
  await requete('insert into inscription_tentative (ip_empreinte) values ($1)', [e]);
  return true;
}
