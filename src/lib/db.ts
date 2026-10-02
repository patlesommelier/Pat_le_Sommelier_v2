import 'server-only';
import { getDatabase } from '@netlify/database';
import pg from 'pg';

// Les colonnes numeric reviennent en nombre (prix), pas en texte.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

// Netlify Database : la connexion est fournie par la plateforme (NETLIFY_DB_URL).
// DATABASE_URL, si elle est définie, permet de viser une autre base Postgres.
const globalPourDb = globalThis as unknown as { __patDb?: ReturnType<typeof getDatabase> };

function db() {
  if (!globalPourDb.__patDb) {
    const url = process.env.DATABASE_URL;
    globalPourDb.__patDb = getDatabase(url ? { connectionString: url } : undefined);
  }
  return globalPourDb.__patDb;
}

export async function requete<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  // pg.Pool ou Pool serverless : même interface query(texte, valeurs).
  const r = await (db().pool as pg.Pool).query(sql, params);
  return r.rows as T[];
}
