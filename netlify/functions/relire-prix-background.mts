/**
 * Fonction Netlify d'arrière-plan (suffixe « -background » : réponse 202 immédiate, jusqu'à 15 minutes de travail).
 * Relit les prix des plats sur le menu envoyé par le super-admin (file relecture_prix, statut « en_attente »).
 * Elle ne fait que des relectures déjà demandées : l'appeler sans rien en attente ne fait rien.
 */
import pg from 'pg';
import { traiterRelecturesPrix } from '../../src/lib/inscription/prix';

const DUREE_MAX_MS = 12 * 60 * 1000;

export default async (req: Request) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[prix] DATABASE_URL manquante');
    return;
  }
  const pool = new pg.Pool({ connectionString: url, max: 2, ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? false : { rejectUnauthorized: false } });
  const q = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
  try {
    const restants = await traiterRelecturesPrix(q, { finAvant: Date.now() + DUREE_MAX_MS });
    if (restants > 0) await fetch(req.url, { method: 'POST' });
  } finally {
    await pool.end();
  }
};
