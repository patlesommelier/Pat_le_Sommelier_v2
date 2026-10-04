/**
 * Applique à la base les migrations de supabase/migrations qui manquent, sans toucher aux données.
 *
 *   npm run migrer
 *
 * Lancé par Netlify avant chaque build de production (netlify.toml) : la base est à jour avant le nouveau code.
 * Si une migration échoue, rien n'est appliqué, le build s'arrête et le site en ligne ne change pas.
 * Les aperçus de déploiement (deploy previews, branches) ne migrent jamais la base de production.
 * Variable requise : DATABASE_URL (dans Netlify, portée « Builds » incluse).
 */
import 'dotenv/config';
import { migrer, ouvrirPool } from './lib/migrations';

async function main() {
  const contexte = process.env.CONTEXT; // fourni par Netlify : production, deploy-preview, branch-deploy…
  if (contexte && contexte !== 'production') {
    console.log(`Migrations ignorées : déploiement « ${contexte} » (seule la production migre la base).`);
    return;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL manquante : dans Netlify, ajoutez-la aux variables d’environnement avec la portée « Builds ».');
  }
  const pool = ouvrirPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const appliquees = await migrer(client);
    await client.query('commit');
    console.log(appliquees.length ? `Migrations appliquées : ${appliquees.join(', ')}` : 'Base à jour : aucune migration à appliquer.');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
