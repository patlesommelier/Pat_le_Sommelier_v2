/**
 * Fonction Netlify d'arrière-plan : envoie à Wine Labs les demandes d'étiquettes en file
 * (vin_carte.etiquette_statut = 'a_demander', posé à l'inscription ou par « Chercher les étiquettes manquantes »).
 * Elle ne fait que des demandes déjà mises en file : l'appeler sans rien en file ne fait rien.
 * Après 12 minutes, elle se relance elle-même s'il reste des vins.
 */
import pg from 'pg';
import { traiterFile } from '../../src/lib/etiquettes/wine-labs';

const DUREE_MAX_MS = 12 * 60 * 1000;

export default async (req: Request) => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[wine-labs] DATABASE_URL manquante');
    return;
  }
  const pool = new pg.Pool({ connectionString: url, max: 2, ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? false : { rejectUnauthorized: false } });
  const q = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
  try {
    const restants = await traiterFile(q, { finAvant: Date.now() + DUREE_MAX_MS });
    if (restants > 0) await fetch(req.url, { method: 'POST' });
  } finally {
    await pool.end();
  }
};
