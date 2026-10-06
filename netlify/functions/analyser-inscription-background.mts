/**
 * Fonction Netlify d'arrière-plan (suffixe « -background » : réponse 202 immédiate, jusqu'à 15 minutes de travail).
 * Lit la carte des vins et le menu déposés sur la page d'accueil (file inscription.analyse, statut « en_attente »).
 * Elle ne fait que des lectures déjà demandées par un dépôt de fichiers : l'appeler sans rien en attente ne fait rien.
 */
import pg from 'pg';
import { traiterAnalyses } from '../../src/lib/inscription/analyse';

const DUREE_MAX_MS = 12 * 60 * 1000;

export default async (req: Request) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[inscription] DATABASE_URL manquante');
    return;
  }
  const pool = new pg.Pool({ connectionString: url, max: 2, ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? false : { rejectUnauthorized: false } });
  const q = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
  try {
    const restants = await traiterAnalyses(q, { finAvant: Date.now() + DUREE_MAX_MS });
    if (restants > 0) await fetch(req.url, { method: 'POST' });
  } finally {
    await pool.end();
  }
};
