/**
 * Import des bases de Pat et des restaurants vers Postgres (Netlify Database via --sql, ou toute base via DATABASE_URL).
 *
 *   npm run import                 → importe tout (Pat + tous les restaurants de data/restaurants)
 *   npm run import -- --dry-run    → n'écrit rien, affiche le bilan et écrit data/import-apercu.json
 *   npm run import -- --sql <f>    → écrit une migration de données pour Netlify Database au lieu d'une base
 *
 * Sans --sql, variable requise : DATABASE_URL (Supabase > Project Settings > Database > Connection string, mode « Session »).
 * Les fichiers de Pat restent la source : relancer l'import après chaque mise à jour d'Excel/JSON.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { importerPrincipes, importerProducteurs, importerTerroirs, type Ligne } from './lib/pat';
import { migrer, ouvrirPool } from './lib/migrations';
import { importerRestaurant } from './lib/restaurant';
import { partagerEtiquettes } from '../src/lib/etiquettes/partage';

const DRY = process.argv.includes('--dry-run');
// --sql <fichier> : n'écrit pas dans la base, produit un fichier SQL (migration de données Netlify Database).
const iSql = process.argv.indexOf('--sql');
const SQL_SORTIE = iSql > -1 ? process.argv[iSql + 1] : null;

/** Faux client qui inscrit chaque requête, valeurs incluses, dans un script SQL. */
function clientSql() {
  const lignes: string[] = [];
  const litteral = (v: unknown) => {
    const p = (pg as unknown as { utils: { prepareValue(v: unknown): unknown } }).utils.prepareValue(v);
    return p === null || p === undefined ? 'null' : pg.Client.prototype.escapeLiteral(String(p));
  };
  const client = {
    async query(sql: string, params: unknown[] = []) {
      if (!/^(begin|commit|rollback)$/i.test(sql.trim())) {
        lignes.push(`${sql.replace(/\$(\d+)/g, (_, n) => litteral(params[Number(n) - 1])).trim()};`);
      }
      // Le ménage lit rowCount : on ne sait pas d'avance combien de lignes la migration retirera.
      return { rows: [], rowCount: 0 };
    },
  };
  return { client: client as unknown as pg.PoolClient, lignes };
}

/**
 * insert … on conflict do update. `surcharges` remplace l'expression d'une colonne ; `garder` (condition SQL sur la ligne
 * existante) conserve toute la ligne existante : sert aux lignes modifiées dans le back-office.
 */
async function upsert(client: pg.PoolClient, table: string, lignes: Ligne[], conflit = 'id', surcharges: Record<string, string> = {}, garder?: string) {
  if (!lignes.length) return 0;
  const cols = Object.keys(lignes[0]);
  const maj = cols.filter((c) => !conflit.split(',').includes(c)).map((c) => {
    const expr = surcharges[c] ?? `excluded.${c}`;
    return `${c} = ${garder ? `case when ${garder} then ${table}.${c} else ${expr} end` : expr}`;
  }).join(', ');
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

/** Supprime les lignes qui ne figurent plus dans les fichiers (les fichiers de Pat font foi). */
async function nettoyer(client: pg.PoolClient, table: string, ids: unknown[], filtre = 'true') {
  const r = await client.query(`delete from ${table} where ${filtre} and not (id = any($1))`, [ids]);
  if (r.rowCount) console.log(`  ${table} : ${r.rowCount} ligne(s) retirée(s), absentes des fichiers`);
}

async function main() {
  console.log('Lecture des fichiers de Pat…');
  const { principes, questions } = await importerPrincipes(path.join('data', 'pat', 'principes_pat_V5.xlsx'));
  const { terroirs, stats } = await importerTerroirs(path.join('data', 'pat', 'terroirs'));
  const { producteurs, cuvees, liens, unique } = await importerProducteurs(path.join('data', 'pat', 'producteurs'), terroirs);

  const restos: Awaited<ReturnType<typeof importerRestaurant>>[] = [];
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
      regles_selection: r.reglesSelection.length,
      regles_ponctuelles: r.regles.length,
    })),
  };
  console.log(JSON.stringify(bilan, null, 2));

  if (DRY) {
    fs.writeFileSync(path.join('data', 'import-apercu.json'), JSON.stringify({ principes, questions, terroirs: terroirs.slice(0, 20), producteurs: producteurs.slice(0, 10), cuvees: cuvees.slice(0, 20), restos }, null, 2));
    console.log('Mode --dry-run : rien n\'a été écrit. Aperçu dans data/import-apercu.json');
    return;
  }

  async function ecrire(client: pg.PoolClient) {
    await upsert(client, 'principe', principes);
    await upsert(client, 'question_pat', questions, 'numero');
    // Terroirs en deux temps : d'abord sans parent, puis les liens parent → enfant.
    await upsert(client, 'terroir', terroirs.map((t) => ({ ...t, parent_id: null })));
    for (const t of terroirs.filter((t) => t.parent_id)) await client.query('update terroir set parent_id = $1 where id = $2', [t.parent_id, t.id]);
    await upsert(client, 'producteur', producteurs);
    // Producteurs proposés depuis les cartes : une décision de Pat prise dans le back-office (validé, retiré) est conservée.
    for (const r of restos) await upsert(client, 'producteur', r.nouveauxProducteurs, 'id', {
      statut: `case when producteur.statut <> 'propose' then producteur.statut else excluded.statut end`,
    });
    const tousLiens = [...liens, ...restos.flatMap((r) => r.liens)];
    await upsert(client, 'producteur_terroir', tousLiens, 'producteur_id, terroir_id');
    await upsert(client, 'cuvee', cuvees);
    // Ménage : terroirs, producteurs et cuvées qui ne sont plus dans les fichiers (ids changés, doublons retirés).
    const tousProd = [...producteurs, ...restos.flatMap((r) => r.nouveauxProducteurs)];
    await nettoyer(client, 'cuvee', cuvees.map((c) => c.id), "coalesce(source, '') <> 'carte'"); // cuvées créées depuis les cartes (étiquettes) : gardées
    await client.query('delete from producteur_terroir where not ((producteur_id, terroir_id) in (select * from unnest($1::text[], $2::text[])))',
      [tousLiens.map((l) => l.producteur_id), tousLiens.map((l) => l.terroir_id)]);
    await nettoyer(client, 'producteur', tousProd.map((p) => p.id), `id not like 'bo-%'`); // producteurs proposés depuis le back-office : gardés
    await nettoyer(client, 'terroir', terroirs.map((t) => t.id));
    for (const r of restos) {
      // Apparence et textes réglés dans le back-office : l'import ne les remplace plus.
      await upsert(client, 'restaurant', [r.restaurant], 'id', {}, 'restaurant.modifie_bo is not null');
      await upsert(client, 'plat', r.plats, 'id', {}, 'plat.modifie_bo is not null');
      await upsert(client, 'profil_accord', r.profils, 'plat_id');
      // Une étiquette venue de Wine Labs ou photographiée par le restaurant n'est pas remplacée par l'import.
      await upsert(client, 'vin_carte', r.vins, 'id', {
        etiquette_url: `case when vin_carte.etiquette_source in ('wine_labs', 'restaurant') then vin_carte.etiquette_url else coalesce(excluded.etiquette_url, vin_carte.etiquette_url) end`,
        etiquette_source: `case when vin_carte.etiquette_source in ('wine_labs', 'restaurant') then vin_carte.etiquette_source else coalesce(excluded.etiquette_source, vin_carte.etiquette_source) end`,
      }, 'vin_carte.modifie_bo is not null');
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
           on conflict (plat_id, vin_id) do update set note = excluded.note, rang = excluded.rang,
             -- Commentaire généré (npm run commentaires) gardé tant que la note ne change pas ; sinon il est à régénérer.
             explication = case when accord.explication_generee_le is not null and accord.note = excluded.note then accord.explication else excluded.explication end,
             limite = case when accord.note = excluded.note then accord.limite end,
             explication_generee_le = case when accord.note = excluded.note then accord.explication_generee_le end,
             principes = excluded.principes, service = excluded.service, statut = excluded.statut, calcule_le = now()
           where accord.origine = 'pat' and accord.statut <> 'refuse' and accord.commentaire_sommelier is null and accord.regenere_le is null`,
          valeurs,
        );
      }
      // Les consignes ajoutées dans le back-office (ids « …-bo-… ») ne viennent pas des fichiers : on les garde.
      await nettoyer(client, 'regle_sommelier', r.regles.map((x) => x.id), `restaurant_id = '${r.restaurant.id}' and id not like '%-bo-%'`);
      await upsert(client, 'regle_sommelier', r.regles);
      await nettoyer(client, 'regle_selection', r.reglesSelection.map((x) => x.id), `restaurant_id = '${r.restaurant.id}'`);
      await upsert(client, 'regle_selection', r.reglesSelection);
    }
  }

  if (SQL_SORTIE) {
    const { client, lignes } = clientSql();
    await ecrire(client);
    fs.mkdirSync(path.dirname(SQL_SORTIE), { recursive: true });
    fs.writeFileSync(SQL_SORTIE, `-- Généré par « npm run import -- --sql ${SQL_SORTIE} » à partir des fichiers de data/.\n${lignes.join('\n')}\n`);
    console.log(`Script SQL écrit dans ${SQL_SORTIE}`);
    return;
  }

  const pool = ouvrirPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await migrer(client);
    await ecrire(client);
    // Étiquettes par cuvée (base de Pat) : rattachement des vins importés.
    const recues = await partagerEtiquettes(async (sql, params = []) => (await client.query(sql, params)).rows);
    await client.query('commit');
    console.log(`Import terminé.${recues ? ` Étiquettes reprises de la base : ${recues} vin(s).` : ''}`);
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
