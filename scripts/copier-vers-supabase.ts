/**
 * Copie les données de Netlify Database vers Supabase (migration unique, peut être relancée).
 *
 *   npm run copier-vers-supabase
 *
 * Variables requises :
 *   NETLIFY_DB_URL  chaîne de connexion de l'ancienne base Netlify Database (source, lue seulement)
 *   DATABASE_URL    chaîne de connexion Supabase (cible)
 *
 * Le schéma de supabase/migrations est d'abord appliqué à la cible, puis chaque table y est vidée et
 * remplie avec le contenu de la source, dans une seule transaction : en cas d'erreur, Supabase reste intact.
 * Contrairement à « npm run import », les accords validés, refusés ou commentés par le sommelier sont repris tels quels.
 */
import 'dotenv/config';
import pg from 'pg';
import { migrer, pool } from './lib/migrations';

// Dates gardées en texte : une conversion en Date JavaScript perdrait les microsecondes.
pg.types.setTypeParser(1184, (v) => v);
pg.types.setTypeParser(1114, (v) => v);

// Ordre des clés étrangères ; « auto » = colonne qui pointe vers la même table, remplie dans un second temps.
const TABLES: { nom: string; cle: string; auto?: string }[] = [
  { nom: 'principe', cle: 'id' },
  { nom: 'question_pat', cle: 'numero' },
  { nom: 'terroir', cle: 'id', auto: 'parent_id' },
  { nom: 'producteur', cle: 'id' },
  { nom: 'producteur_terroir', cle: 'producteur_id, terroir_id' },
  { nom: 'cuvee', cle: 'id' },
  { nom: 'restaurant', cle: 'id' },
  { nom: 'plat', cle: 'id', auto: 'variante_de' },
  { nom: 'profil_accord', cle: 'plat_id' },
  { nom: 'vin_carte', cle: 'id' },
  { nom: 'accord', cle: 'id' },
  { nom: 'regle_sommelier', cle: 'id' },
  { nom: 'regle_selection', cle: 'id' },
];

async function existe(client: pg.PoolClient, table: string) {
  const { rows } = await client.query('select to_regclass($1) as t', [`public.${table}`]);
  return Boolean(rows[0].t);
}

async function main() {
  const source = process.env.NETLIFY_DB_URL;
  const cible = process.env.DATABASE_URL;
  if (!source || !cible) throw new Error('NETLIFY_DB_URL (source) et DATABASE_URL (Supabase) sont nécessaires (voir .env.example)');
  if (source === cible) throw new Error('NETLIFY_DB_URL et DATABASE_URL désignent la même base');

  const src = pool(source);
  const dst = pool(cible);
  const lecture = await src.connect();
  const ecriture = await dst.connect();
  try {
    await ecriture.query('begin');
    await migrer(ecriture);

    // Vidage dans l'ordre inverse des dépendances.
    for (const t of [...TABLES].reverse()) await ecriture.query(`delete from ${t.nom}`);

    for (const t of TABLES) {
      if (!(await existe(lecture, t.nom))) { console.log(`  ${t.nom} : absente de la source, ignorée`); continue; }
      const { rows } = await lecture.query(`select * from ${t.nom} order by ${t.cle}`);
      // json_populate_recordset convertit tableaux, enums et jsonb selon les types de la table cible.
      for (let i = 0; i < rows.length; i += 500) {
        const lot = t.auto ? rows.slice(i, i + 500).map((r) => ({ ...r, [t.auto!]: null })) : rows.slice(i, i + 500);
        await ecriture.query(
          `insert into ${t.nom} overriding system value select * from json_populate_recordset(null::${t.nom}, $1)`,
          [JSON.stringify(lot)],
        );
      }
      if (t.auto) {
        const liens = rows.filter((r) => r[t.auto!] !== null);
        await ecriture.query(
          `update ${t.nom} set ${t.auto} = l.parent from unnest($1::text[], $2::text[]) as l(id, parent) where ${t.nom}.id = l.id`,
          [liens.map((r) => r.id), liens.map((r) => r[t.auto!])],
        );
      }
      console.log(`  ${t.nom} : ${rows.length} ligne(s)`);
    }

    // Les prochains accords créés reprennent la numérotation après les accords copiés.
    await ecriture.query(`select setval(pg_get_serial_sequence('accord', 'id'), coalesce((select max(id) from accord), 0) + 1, false)`);
    await ecriture.query('commit');
    console.log('Copie vers Supabase terminée.');
  } catch (e) {
    await ecriture.query('rollback');
    throw e;
  } finally {
    lecture.release();
    ecriture.release();
    await src.end();
    await dst.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
