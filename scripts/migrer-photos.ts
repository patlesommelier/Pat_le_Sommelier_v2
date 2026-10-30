/**
 * Déplace les images (logos, étiquettes, photos de plats) de Supabase Storage vers le stockage Hetzner,
 * puis remplace leurs adresses partout dans la base.
 *
 *   npm run migrer-photos                : liste ce qui serait déplacé, sans rien changer
 *   npm run migrer-photos -- --appliquer : copie les images, puis met les adresses à jour
 *
 * Utilise DATABASE_URL (la base du site) et les variables STOCKAGE_S3_… (le stockage Hetzner).
 * Sans risque à relancer : une image déjà déplacée n'a plus d'adresse Supabase, elle n'est pas recopiée.
 * Les images restent chez Supabase tant qu'on ne les y supprime pas : un retour en arrière reste possible.
 */
import pg from 'pg';
import { sslBase } from '../src/lib/ssl-base';
import { configStockage, deposerObjet } from '../src/lib/stockage';

// Adresse publique d'une image Supabase : https://<projet>.supabase.co/storage/v1/object/public/<bucket>/<nom>
const MOTIF = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/[^/\s"']+\/[^\s"'<>)]+/g;

async function main() {
  const appliquer = process.argv.includes('--appliquer');
  const c = configStockage();
  if (!c) throw new Error('Stockage Hetzner non configuré : ajoutez les variables STOCKAGE_S3_… au site, puis relancez.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquante.');
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: sslBase(process.env.DATABASE_URL) });
  await db.connect();
  try {
    // Toutes les colonnes de texte (et JSON) du schéma public qui contiennent une adresse Supabase Storage.
    const { rows: colonnes } = await db.query<{ t: string; c: string; type: string }>(
      `select table_name as t, column_name as c, data_type as type from information_schema.columns
        where table_schema = 'public' and (data_type in ('text', 'character varying', 'jsonb', 'json')
               or (data_type = 'ARRAY' and udt_name in ('_text', '_varchar'))) -- listes de texte seulement (pas les listes de couleurs…)
          and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')`);
    const trouvees = new Map<string, Set<string>>(); // adresse → « table.colonne »
    for (const { t, c: col } of colonnes) {
      const { rows } = await db.query<{ v: string }>(`select "${col}"::text as v from public."${t}" where "${col}"::text like '%supabase.co/storage/%'`);
      for (const { v } of rows) for (const u of v.match(MOTIF) ?? []) trouvees.set(u, (trouvees.get(u) ?? new Set()).add(`${t}.${col}`));
    }
    const parColonne = new Map<string, number>();
    for (const lieux of trouvees.values()) for (const l of lieux) parColonne.set(l, (parColonne.get(l) ?? 0) + 1);
    console.log(`${trouvees.size} image(s) chez Supabase, utilisées dans :`);
    for (const [l, n] of [...parColonne].sort()) console.log(`  ${l.padEnd(40)}${String(n).padStart(6)}`);
    if (!appliquer) { console.log('\nRien n’a été changé. Pour déplacer les images : npm run migrer-photos -- --appliquer'); return; }

    let faites = 0;
    const echecs: string[] = [];
    const remplacements = new Map<string, string>();
    for (const ancienne of trouvees.keys()) {
      try {
        const r = await fetch(ancienne, { signal: AbortSignal.timeout(30_000) });
        if (!r.ok) throw new Error(`téléchargement ${r.status}`);
        const type = (r.headers.get('content-type') ?? 'application/octet-stream').split(';')[0];
        const nom = decodeURIComponent(ancienne.replace(/^.*\/object\/public\/[^/]+\//, '').split('?')[0]);
        remplacements.set(ancienne, await deposerObjet(nom, Buffer.from(await r.arrayBuffer()), type, c));
        if (++faites % 25 === 0) console.log(`  ${faites} / ${trouvees.size} copiée(s)…`);
      } catch (e) {
        echecs.push(`${ancienne} : ${(e as Error).message}`);
      }
    }
    console.log(`${faites} image(s) copiée(s) vers ${c.urlPublique}.`);

    // Adresses remplacées dans la base, en une seule transaction (tout ou rien).
    await db.query('begin');
    let lignes = 0;
    for (const { t, c: col, type } of colonnes) {
      for (const [ancienne, nouvelle] of remplacements) {
        const expr = type === 'jsonb' || type === 'json' ? `replace("${col}"::text, $1, $2)::${type}`
          : type === 'ARRAY' ? `(select array_agg(replace(x, $1, $2)) from unnest("${col}") x)` : `replace("${col}", $1, $2)`;
        const r = await db.query(`update public."${t}" set "${col}" = ${expr} where "${col}"::text like '%' || $1 || '%'`, [ancienne, nouvelle]);
        lignes += r.rowCount ?? 0;
      }
    }
    await db.query('commit');
    console.log(`${lignes} valeur(s) mise(s) à jour dans la base.`);
    if (echecs.length) {
      console.log(`\n✗ ${echecs.length} image(s) non déplacée(s) (leur adresse Supabase est gardée) :`);
      for (const e of echecs) console.log(`  ${e}`);
      process.exitCode = 1;
    } else console.log('✓ Toutes les images sont chez Hetzner.');
  } catch (e) {
    await db.query('rollback').catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(`✗ ${(e as Error).message}`); process.exitCode = 1; });
