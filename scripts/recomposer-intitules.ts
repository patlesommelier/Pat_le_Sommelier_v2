/**
 * Aperçu (ou application) des intitulés de vins recomposés à partir de leurs champs.
 *
 *   npx tsx scripts/recomposer-intitules.ts              (aperçu : avant → après)
 *   npx tsx scripts/recomposer-intitules.ts --appliquer
 */
import 'dotenv/config';
import { ouvrirPool } from './lib/migrations';
import { recomposerIntitules } from './lib/intitules';

async function main() {
  const pool = ouvrirPool();
  try {
    const changes = await recomposerIntitules(async (sql, params = []) => (await pool.query(sql, params)).rows, { appliquer: process.argv.includes('--appliquer') });
    for (const c of changes) console.log(`${c.id} | ${c.avant}  →  ${c.apres}`);
    console.log(`${changes.length} intitulé(s) ${process.argv.includes('--appliquer') ? 'changé(s)' : 'à changer'}.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
