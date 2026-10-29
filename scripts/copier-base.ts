/**
 * Copie des données de Pat le Sommelier d'une base Postgres à une autre (migration Supabase → Hetzner, ou retour en arrière),
 * puis comparaison du nombre de lignes de chaque table des deux côtés.
 *
 *   npm run copier-base              : demande l'adresse de la base source ; la cible est DATABASE_URL (la base du site)
 *   npm run copier-base -- --verifier : compare seulement les nombres de lignes, sans rien copier
 *
 * Les adresses se tapent dans le terminal (jamais dans un message). La cible est VIDÉE puis remplie : il faut taper OUI.
 * Seules les tables du schéma public sont copiées (pas les comptes ni les photos de Supabase, qui restent chez Supabase).
 * Les deux bases doivent être au même niveau de migration : le site, en démarrant, a déjà créé les tables de la cible.
 */
import readline from 'node:readline/promises';
import pg from 'pg';
import { sslBase } from '../src/lib/ssl-base';

const LOT = 500;
const masquer = (url: string) => url.replace(/\/\/([^:@/]+):[^@]*@/, '//$1:***@');
const id = (t: string) => `public."${t.replace(/"/g, '""')}"`;
const col = (c: string) => `"${c.replace(/"/g, '""')}"`;

async function connecter(url: string) {
  const c = new pg.Client({ connectionString: url, ssl: sslBase(url) });
  await c.connect();
  return c;
}

async function tables(c: pg.Client) {
  const { rows } = await c.query<{ t: string }>(
    `select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`);
  return rows.map((r) => r.t);
}

/** Tables rangées pour que chaque table vienne après celles qu'elle référence (clés étrangères). */
async function ordre(c: pg.Client, liste: string[]) {
  const { rows } = await c.query<{ enfant: string; parent: string }>(
    `select tc.table_name as enfant, ccu.table_name as parent
       from information_schema.table_constraints tc
       join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public' and ccu.table_name <> tc.table_name`);
  const rangees: string[] = [];
  const reste = new Set(liste);
  while (reste.size) {
    const pretes = [...reste].filter((t) => !rows.some((r) => r.enfant === t && reste.has(r.parent)));
    const prises = pretes.length ? pretes : [[...reste][0]]; // cycle : on prend la suivante (contraintes désactivées si possible)
    for (const t of prises) { rangees.push(t); reste.delete(t); }
  }
  return rangees;
}

async function compter(c: pg.Client, liste: string[]) {
  const n = new Map<string, number>();
  for (const t of liste) n.set(t, Number((await c.query<{ n: string }>(`select count(*) as n from ${id(t)}`)).rows[0].n));
  return n;
}

async function comparer(source: pg.Client, cible: pg.Client, liste: string[]) {
  const [a, b] = [await compter(source, liste), await compter(cible, liste)];
  let ecarts = 0;
  console.log(`\n${'Table'.padEnd(34)}${'Source'.padStart(10)}${'Cible'.padStart(10)}`);
  for (const t of liste) {
    const ok = a.get(t) === b.get(t);
    if (!ok) ecarts++;
    console.log(`${ok ? '  ' : '✗ '}${t.padEnd(32)}${String(a.get(t)).padStart(10)}${String(b.get(t)).padStart(10)}`);
  }
  const total = (m: Map<string, number>) => [...m.values()].reduce((x, y) => x + y, 0);
  console.log(`\n${liste.length} tables, ${total(a)} lignes à la source, ${total(b)} dans la cible.`);
  console.log(ecarts ? `✗ ${ecarts} table(s) différente(s) : NE PAS BASCULER.` : '✓ Toutes les tables sont identiques.');
  return ecarts;
}

async function main() {
  const verifier = process.argv.includes('--verifier');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const urlSource = process.env.SOURCE_DATABASE_URL || (await rl.question('Adresse de la base SOURCE (Supabase : « Session pooler », port 5432) : ')).trim();
  const urlCible = process.env.CIBLE_DATABASE_URL || process.env.DATABASE_URL || (await rl.question('Adresse de la base CIBLE : ')).trim();
  if (!urlSource || !urlCible) throw new Error('Il faut une adresse source et une adresse cible.');
  if (urlSource === urlCible) throw new Error('La source et la cible sont la même base.');
  console.log(`Source : ${masquer(urlSource)}\nCible  : ${masquer(urlCible)}`);

  const [source, cible] = [await connecter(urlSource), await connecter(urlCible)];
  try {
    // Même niveau de migration des deux côtés, sinon les tables ne correspondent pas.
    const migrations = async (c: pg.Client) => (await c.query<{ nom: string }>('select nom from schema_migration order by nom')).rows.map((r) => r.nom).join(',');
    const [ms, mc] = [await migrations(source), await migrations(cible)];
    if (ms !== mc) throw new Error('Les deux bases ne sont pas au même niveau de migration : déployez la même version du site des deux côtés, puis recommencez.');
    const [ts, tc] = [await tables(source), await tables(cible)];
    const absentes = ts.filter((t) => !tc.includes(t));
    if (absentes.length) console.log(`Tables de la source absentes de la cible (non copiées) : ${absentes.join(', ')}`);
    const liste = await ordre(cible, tc.filter((t) => ts.includes(t)));

    if (verifier) { process.exitCode = (await comparer(source, cible, liste)) ? 1 : 0; return; }

    const reponse = process.env.CONFIRMATION === 'OUI' ? 'OUI' // essais automatiques
      : (await rl.question(`\nLa base CIBLE va être VIDÉE puis remplie avec la source (${liste.length} tables). Tapez OUI pour continuer : `)).trim();
    if (reponse !== 'OUI') { console.log('Annulé : rien n’a été changé.'); return; }

    // Une photo fixe de la source pendant toute la copie ; la cible ne change qu'à la fin (tout ou rien).
    await source.query('begin isolation level repeatable read read only');
    await cible.query('begin');
    await cible.query('savepoint replique');
    try { await cible.query('set local session_replication_role = replica'); } catch { await cible.query('rollback to savepoint replique'); }
    await cible.query(`truncate ${liste.map(id).join(', ')} restart identity cascade`);
    for (const t of liste) {
      const { rows: cols } = await cible.query<{ c: string }>(
        `select column_name as c from information_schema.columns
          where table_schema = 'public' and table_name = $1 and is_generated <> 'ALWAYS' order by ordinal_position`, [t]);
      const noms = cols.map((x) => col(x.c)).join(', ');
      let copiees = 0;
      for (let decalage = 0; ; decalage += LOT) {
        const { rows } = await source.query<{ r: unknown }>(`select to_jsonb(x) as r from ${id(t)} x order by ctid limit ${LOT} offset ${decalage}`);
        if (!rows.length) break;
        await cible.query(`insert into ${id(t)} (${noms}) overriding system value select ${noms} from jsonb_populate_recordset(null::${id(t)}, $1::jsonb)`,
          [JSON.stringify(rows.map((x) => x.r))]);
        copiees += rows.length;
        if (rows.length < LOT) break;
      }
      // Compteurs (numéros automatiques) : repartent après la plus grande valeur copiée.
      const { rows: seqs } = await cible.query<{ c: string; s: string }>(
        `select column_name as c, pg_get_serial_sequence($1, column_name) as s from information_schema.columns
          where table_schema = 'public' and table_name = $2 and pg_get_serial_sequence($1, column_name) is not null`, [`public."${t}"`, t]);
      for (const s of seqs) await cible.query(`select setval($1, coalesce((select max(${col(s.c)}) from ${id(t)}), 0) + 1, false)`, [s.s]);
      console.log(`  ${t.padEnd(32)}${String(copiees).padStart(10)} ligne(s)`);
    }
    await cible.query('commit');
    await source.query('commit');
    console.log('\nCopie terminée. Vérification :');
    process.exitCode = (await comparer(source, cible, liste)) ? 1 : 0;
  } catch (e) {
    await cible.query('rollback').catch(() => {});
    console.error(`\n✗ Copie interrompue, la cible n'a pas changé : ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
    await Promise.all([source.end(), cible.end()]);
  }
}

main();
