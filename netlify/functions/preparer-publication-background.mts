/**
 * Fonction Netlify d'arrière-plan (suffixe « -background » : réponse 202 immédiate, jusqu'à 15 minutes de travail).
 * Appelée par « Publier les principes » (préparation) : Pat note à nouveau chaque plat avec le brouillon,
 * résultats mis de côté (publication_accord), rien ne change chez les clients avant la confirmation.
 * Elle ne fait que des tâches déjà demandées par le super-admin : l'appeler sans tâche en attente ne fait rien.
 * Après 12 minutes, elle se relance elle-même s'il reste des plats.
 */
import pg from 'pg';
import { travaillerPublications } from '../../src/lib/publication/publication';

const DUREE_MAX_MS = 12 * 60 * 1000;

export default async (req: Request) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[publication] DATABASE_URL manquante');
    return;
  }
  const pool = new pg.Pool({ connectionString: url, max: 2, ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? false : { rejectUnauthorized: false } });
  const q = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
  try {
    const restants = await travaillerPublications(q, { finAvant: Date.now() + DUREE_MAX_MS });
    if (restants > 0) await fetch(req.url, { method: 'POST' });
  } finally {
    await pool.end();
  }
};
