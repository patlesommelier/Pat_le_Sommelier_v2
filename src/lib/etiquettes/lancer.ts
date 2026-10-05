import 'server-only';
import { requete } from '../db';
import { mettreEnFile, traiterFile } from './wine-labs';

const origineSite = () => (process.env.URL ?? process.env.URL_PUBLIQUE ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

/**
 * Cherche chez Wine Labs les étiquettes manquantes d'un restaurant (une demande par cuvée) :
 * mise en file, puis envoi par la fonction Netlify d'arrière-plan (hors Netlify : par le serveur lui-même).
 * Renvoie le nombre de vins mis en file.
 */
export async function chercherEtiquettesManquantes(restaurantId: string, options: { vins?: string[]; relancer?: boolean } = {}) {
  const n = await mettreEnFile(requete, restaurantId, options);
  if (!n) return 0;
  const base = origineSite();
  const statut = base
    ? await fetch(`${base}/.netlify/functions/etiquettes-wine-labs-background`, { method: 'POST' }).then((r) => r.status).catch(() => 0)
    : 0;
  if (statut !== 202 && statut !== 200) void traiterFile(requete, { finAvant: Date.now() + 15 * 60 * 1000 }).catch((e) => console.error('[wine-labs]', e));
  return n;
}
