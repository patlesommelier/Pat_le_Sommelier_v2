import 'server-only';
import { getDatabase, type DatabaseConnection } from '@netlify/database';
import pg from 'pg';

// Les colonnes numeric reviennent en nombre (prix), pas en texte.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

const globalPourDb = globalThis as unknown as { __patDb?: DatabaseConnection };

// Netlify Database : la connexion est fournie par la plateforme (NETLIFY_DB_URL), rien à configurer.
function db(): DatabaseConnection {
  globalPourDb.__patDb ??= getDatabase();
  return globalPourDb.__patDb;
}

export async function requete<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  // pg.Pool (serveur) ou Pool Neon (serverless) : même interface query().
  const r = await (db().pool as pg.Pool).query(sql, params);
  return r.rows as T[];
}
