/**
 * Fonction Netlify d'arrière-plan : Pat choisit les vins pour plusieurs plats à la même table (principes « plusieurs plats »)
 * et le choix est gardé (accord_table). La page des propositions s'affiche sans attendre et se met à jour ensuite.
 * Elle ne fait qu'une demande déjà préparée par la page (marquée « en cours » dans accord_table).
 */
import pg from 'pg';
import { calculerChoixTable, type DemandeTable } from '../../src/lib/plusieurs-plats';

export default async (req: Request) => {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  let d: DemandeTable;
  try { d = await req.json(); } catch { return; }
  const pool = new pg.Pool({ connectionString: url, max: 2, ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? false : { rejectUnauthorized: false } });
  const q = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
  try {
    // Seulement une demande réellement en attente pour ce restaurant (rien d'autre n'est accepté).
    const [en] = await q<{ ok: boolean }>(`select resultat = to_jsonb('en_cours'::text) as ok from accord_table where restaurant_id = $1 and cle = $2`, [d.restaurantId, d.cle]);
    if (en?.ok) await calculerChoixTable(q, d);
  } finally {
    await pool.end();
  }
};
