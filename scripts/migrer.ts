/**
 * Applique à la base les migrations de supabase/migrations qui manquent, sans toucher aux données.
 *
 *   npm run migrer
 *
 * Lancé par Netlify avant chaque build de production (netlify.toml) : la base est à jour avant le nouveau code.
 * Si une migration échoue, rien n'est appliqué, le build s'arrête et le site en ligne ne change pas.
 * Les aperçus de déploiement (deploy previews, branches) ne migrent jamais la base de production.
 * Ensuite, une seule fois : principes V5 en service, V6 en brouillon, règles V7 en service (scripts/lib/versions-initiales.ts).
 * Variable requise : DATABASE_URL (dans Netlify, portée « Builds » incluse).
 */
import 'dotenv/config';
import { migrer, ouvrirPool } from './lib/migrations';
import { initialiserVersionsSiAbsentes } from './lib/versions-initiales';
import { partagerEtiquettes } from '../src/lib/etiquettes/partage';
import { recomposerIntitules } from './lib/intitules';

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
    if (appliquees.includes('0032_intitules_composes.sql')) {
      const changes = await recomposerIntitules(async (sql, params = []) => (await client.query(sql, params)).rows, { appliquer: true });
      console.log(`Intitulés recomposés : ${changes.length} vin(s).`);
    }
    await client.query('commit');
    console.log(appliquees.length ? `Migrations appliquées : ${appliquees.join(', ')}` : 'Base à jour : aucune migration à appliquer.');
    // Premières versions des principes et des règles (une seule fois).
    const faites = await initialiserVersionsSiAbsentes(async (sql, params = []) => (await client.query(sql, params)).rows);
    if (faites.length) console.log(`Versions installées : ${faites.join(', ')}.`);
    // Étiquettes rattachées aux cuvées de la base de Pat (idempotent : ne fait rien quand tout est à jour).
    const recues = await partagerEtiquettes(async (sql, params = []) => (await client.query(sql, params)).rows);
    if (recues) console.log(`Étiquettes partagées par cuvée : ${recues} vin(s).`);
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
