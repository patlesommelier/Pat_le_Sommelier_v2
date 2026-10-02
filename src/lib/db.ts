import 'server-only';
import pg from 'pg';

// Les colonnes numeric reviennent en nombre (prix), pas en texte.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const globalPourPool = globalThis as unknown as { __patPool?: pg.Pool };

function pool(): pg.Pool {
  if (!globalPourPool.__patPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL manquante : voir .env.example');
    globalPourPool.__patPool = new pg.Pool({
      connectionString: url,
      max: 3,
      ssl: /localhost|127\.0\.0\.1|host=\/tmp/.test(url) ? false : { rejectUnauthorized: false },
    });
  }
  return globalPourPool.__patPool;
}

export async function requete<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool().query(sql, params);
  return r.rows as T[];
}
