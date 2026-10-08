/**
 * Fonction Netlify d'arrière-plan (suffixe « -background » : réponse 202 immédiate, jusqu'à 15 minutes de travail).
 * Compare des modèles Claude sur les accords de quelques plats (file comparaison_modeles, demandée par le super-admin).
 * Rien n'est modifié dans les accords : chaque génération est annulée.
 */
import pg from 'pg';
import { traiterComparaisons } from '../../src/lib/generation/comparaison';

export default async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[comparaison] DATABASE_URL manquante');
    return;
  }
  const pool = new pg.Pool({ connectionString: url, max: 3, ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? false : { rejectUnauthorized: false } });
  try {
    await traiterComparaisons(pool, { finAvant: Date.now() + 12 * 60 * 1000 });
  } finally {
    await pool.end();
  }
};
