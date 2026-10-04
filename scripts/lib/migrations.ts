import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

/** Connexion à la base (Supabase) indiquée par DATABASE_URL. */
export function ouvrirPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL manquante (voir .env.example)');
  return new pg.Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? false : { rejectUnauthorized: false } });
}

/**
 * Applique les migrations de supabase/migrations qui ne l'ont pas encore été (suivi dans la table schema_migration).
 * Une base créée avant ce suivi (0001 collé à la main dans Supabase) est reconnue : 0001 est marquée comme faite.
 * À appeler dans une transaction : un verrou évite que deux déploiements (ou un import) migrent en même temps.
 */
export async function migrer(client: pg.PoolClient) {
  await client.query("select pg_advisory_xact_lock(hashtext('pat-le-sommelier:migrations'))");
  await client.query('create table if not exists schema_migration (nom text primary key, appliquee_le timestamptz not null default now())');
  const { rows } = await client.query<{ nom: string }>('select nom from schema_migration');
  const faites = new Set(rows.map((r) => r.nom));
  if (!faites.size) {
    const { rows: t } = await client.query("select to_regclass('public.restaurant') as t");
    if (t[0].t) { await client.query("insert into schema_migration (nom) values ('0001_schema.sql')"); faites.add('0001_schema.sql'); }
  }
  const appliquees: string[] = [];
  const dossier = path.join('supabase', 'migrations');
  for (const f of fs.readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()) {
    if (faites.has(f)) continue;
    console.log(`Migration ${f}…`);
    await client.query(fs.readFileSync(path.join(dossier, f), 'utf8'));
    await client.query('insert into schema_migration (nom) values ($1)', [f]);
    appliquees.push(f);
  }
  return appliquees;
}
