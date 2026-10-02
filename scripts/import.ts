/**
 * Import des bases de Pat et des restaurants vers Postgres (Supabase).
 *
 *   npm run import                 → importe tout (Pat + tous les restaurants de data/restaurants)
 *   npm run import -- --dry-run    → n'écrit rien, affiche le bilan et écrit data/import-apercu.json
 *
 * Variable requise : DATABASE_URL (Supabase > Project Settings > Database > Connection string, mode « Session »).
 * Les fichiers de Pat restent la source : relancer l'import après chaque mise à jour d'Excel/JSON.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { importerPrincipes, importerProducteurs, importerTerroirs, type Ligne } from './lib/pat';
import { importerRestaurant } from './lib/restaurant';

const DRY = process.argv.includes('--dry-run');

async function upsert(client: pg.PoolClient, table: string, lignes: Ligne[], conflit = 'id') {
  if (!lignes.length) return 0;
  const cols = Object.keys(lignes[0]);
  const maj = cols.filter((c) => !conflit.split(',').includes(c)).map((c) => `${c} = excluded.${c}`).join(', ');
  for (let i = 0; i < lignes.length; i += 200) {
    const lot = lignes.slice(i, i + 200);
    const valeurs: unknown[] = [];
    const tuples = lot.map((l, j) => `(${cols.map((c, k) => {
      const v = l[c];
      valeurs.push(v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v);
      return `$${j * cols.length + k + 1}`;
    }).join(', ')})`);
    await client.query(
      `insert into ${table} (${cols.join(', ')}) values ${tuples.join(', ')} on conflict (${conflit}) do ${maj ? `update set ${maj}` : 'nothing'}`,
      valeurs,
    );
  }
  return lignes.length;
}

async function main() {
  console.log('Lecture des fichiers de Pat…');
  const { principes, questions } = await importerPrincipes(path.join('data', 'pat', 'principes_pat_V5.xlsx'));
  const { terroirs, stats } = await importerTerroirs(path.join('data', 'pat', 'terroirs'));
  const { producteurs, cuvees, liens, unique } = await importerProducteurs(path.join('data', 'pat', 'producteurs'), terroirs);

  const restos = [];
  for (const d of fs.readdirSync(path.join('data', 'restaurants'))) {
    const dossier = path.join('data', 'restaurants', d);
    if (fs.existsSync(path.join(dossier, 'restaurant.json'))) {
      console.log(`Lecture du restaurant ${d}…`);
      restos.push(await importerRestaurant(dossier, principes, producteurs, terroirs, unique));
    }
  }

  const bilan = {
    principes: principes.length,
    principes_proposes: principes.filter((p) => p.statut === 'propose').length,
    questions_pat: questions.length,
    terroirs: stats.total,
    terroirs_ranges_sous_une_appellation: stats.sous_appellation,
    producteurs: producteurs.length + restos.reduce((n, r) => n + r.nouveauxProducteurs.length, 0),
    producteurs_proposes_depuis_les_cartes: restos.reduce((n, r) => n + r.nouveauxProducteurs.length, 0),
    cuvees: cuvees.length,
    liens_producteur_appellation: liens.length,
    restaurants: restos.map((r) => ({
      id: r.restaurant.id,
      plats: r.plats.length,
      profils_avec_principes: r.profils.filter((p) => (p.principes as string[]).length).length,
      vins: r.vins.length,
      vins_relies_a_un_producteur: r.vins.filter((v) => v.producteur_id).length,
      vins_relies_a_une_appellation: r.vins.filter((v) => v.appellation_id).length,
      vins_avec_etiquette: r.vins.filter((v) => v.etiquette_url).length,
      accords: r.accords.length,
      regles: r.regles.length,
    })),
  };
  console.log(JSON.stringify(bilan, null, 2));

  if (DRY) {
    fs.writeFileSync(path.join('data', 'import-apercu.json'), JSON.stringify({ principes, questions, terroirs: terroirs.slice(0, 20), producteurs: producteurs.slice(0, 10), cuvees: cuvees.slice(0, 20), restos }, null, 2));
    console.log('Mode --dry-run : rien n\'a été écrit. Aperçu dans data/import-apercu.json');
    return;
  }

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquante (voir .env.example)');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: /localhost|127\.0\.0\.1|\/tmp/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('begin');
    await upsert(client, 'principe', principes);
    await upsert(client, 'question_pat', questions, 'numero');
    // Terroirs en deux temps : d'abord sans parent, puis les liens parent → enfant.
    await upsert(client, 'terroir', terroirs.map((t) => ({ ...t, parent_id: null })));
    for (const t of terroirs.filter((t) => t.parent_id)) await client.query('update terroir set parent_id = $1 where id = $2', [t.parent_id, t.id]);
    await upsert(client, 'producteur', producteurs);
    for (const r of restos) await upsert(client, 'producteur', r.nouveauxProducteurs);
    const tousLiens = [...liens, ...restos.flatMap((r) => r.liens)];
    await upsert(client, 'producteur_terroir', tousLiens, 'producteur_id, terroir_id');
    await upsert(client, 'cuvee', cuvees);
    for (const r of restos) {
      await upsert(client, 'restaurant', [r.restaurant]);
      await upsert(client, 'plat', r.plats);
      await upsert(client, 'profil_accord', r.profils, 'plat_id');
      await upsert(client, 'vin_carte', r.vins);
      // Le fichier d'accords de Pat fait foi et met à jour ses accords à chaque import,
      // sauf ceux que le sommelier a ajoutés, refusés ou commentés : ceux-là ne sont jamais écrasés.
      for (let i = 0; i < r.accords.length; i += 300) {
        const lot = r.accords.slice(i, i + 300);
        const valeurs: unknown[] = [];
        const tuples = lot.map((a, j) => {
          valeurs.push(a.restaurant_id, a.plat_id, a.vin_id, a.note, a.rang, a.explication, a.principes, a.service, a.origine, a.statut);
          return `(${Array.from({ length: 10 }, (_, k) => `$${j * 10 + k + 1}`).join(', ')})`;
        });
        await client.query(
          `insert into accord (restaurant_id, plat_id, vin_id, note, rang, explication, principes, service, origine, statut)
           values ${tuples.join(', ')}
           on conflict (plat_id, vin_id) do update set note = excluded.note, rang = excluded.rang, explication = excluded.explication,
             principes = excluded.principes, service = excluded.service, statut = excluded.statut, calcule_le = now()
           where accord.origine = 'pat' and accord.statut <> 'refuse' and accord.commentaire_sommelier is null`,
          valeurs,
        );
      }
      await upsert(client, 'regle_sommelier', r.regles);
    }
    await client.query('commit');
    console.log('Import terminé.');
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
