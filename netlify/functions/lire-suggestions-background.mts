/**
 * Fonction Netlify d'arrière-plan : lit les photos de suggestions envoyées par un restaurant (file lecture_suggestions),
 * ajoute les plats « Suggestions » au menu et lance la préparation de leurs accords.
 * Elle ne fait que des lectures déjà demandées : l'appeler sans rien en attente ne fait rien.
 */
import pg from 'pg';
import { traiterSuggestions } from '../../src/lib/suggestions';
import { PLATS_EN_PARALLELE, travailler } from '../../src/lib/generation/file';

const DUREE_MAX_MS = 12 * 60 * 1000;

export default async (req: Request) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[suggestions] DATABASE_URL manquante');
    return;
  }
  const pool = new pg.Pool({ connectionString: url, max: 3, ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? false : { rejectUnauthorized: false } });
  const q = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
  const finAvant = Date.now() + DUREE_MAX_MS;
  // Accords des nouvelles suggestions : les travailleurs habituels, sinon ici même (il reste du temps).
  const lancer = async (taches: number) => {
    const statuts = await Promise.all(Array.from({ length: Math.min(PLATS_EN_PARALLELE, taches) }, () =>
      fetch(new URL('/.netlify/functions/generer-accords-background', req.url), { method: 'POST' }).then((r) => r.status).catch(() => 0)));
    if (!statuts.some((s) => s === 202 || s === 200)) await travailler(q, { finAvant });
  };
  try {
    const restants = await traiterSuggestions(q, { finAvant, lancer });
    if (restants > 0) await fetch(req.url, { method: 'POST' });
  } finally {
    await pool.end();
  }
};
