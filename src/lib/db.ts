import 'server-only';
import pg from 'pg';

// Les colonnes numeric reviennent en nombre (prix), pas en texte.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

// Supabase : DATABASE_URL = chaîne « Transaction pooler » (port 6543), adaptée aux fonctions serverless.
const globalPourDb = globalThis as unknown as { __patDb?: pg.Pool };

function db() {
  if (!globalPourDb.__patDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL manquante : chaîne de connexion Supabase (voir .env.example)');
    globalPourDb.__patDb = new pg.Pool({
      connectionString: url,
      ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? false : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return globalPourDb.__patDb;
}

export async function requete<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await db().query(sql, params);
  return r.rows as T[];
}
