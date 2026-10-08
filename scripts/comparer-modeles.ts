/**
 * Compare deux modèles Claude sur les accords de quelques plats, sans rien modifier :
 * chaque génération se fait dans une transaction annulée à la fin, puis les résultats sont mis côte à côte.
 *
 *   npx tsx scripts/comparer-modeles.ts --restaurant chez-pat --plats id1,id2,id3 \
 *     --modeles claude-sonnet-5-5,claude-opus-5-5 --sortie comparaison.html
 *
 * Nécessite DATABASE_URL et ANTHROPIC_API_KEY.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import pg from 'pg';
import { comparerModeles } from '../src/lib/generation/comparaison';

const arg = (nom: string) => { const i = process.argv.indexOf(`--${nom}`); return i > -1 ? process.argv[i + 1] : undefined; };
const html = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function main() {
  const restaurant = arg('restaurant') ?? 'chez-pat';
  const plats = (arg('plats') ?? '').split(',').filter(Boolean);
  const modeles = (arg('modeles') ?? 'claude-sonnet-5-5,claude-opus-5-5').split(',');
  const sortie = arg('sortie') ?? 'comparaison-modeles.html';
  if (!process.env.DATABASE_URL || !process.env.ANTHROPIC_API_KEY) throw new Error('DATABASE_URL et ANTHROPIC_API_KEY sont nécessaires');
  if (!plats.length) throw new Error('--plats id1,id2,id3');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: /localhost|host=\/tmp/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false } });
  const r = await comparerModeles(pool, restaurant, plats, modeles);
  await pool.end();
  const resultats = Object.fromEntries(r.plats.map((p) => [p.id, Object.fromEntries(modeles.map((m) => [m, { ...p.modeles[m], jetons: `${p.modeles[m].jetonsEntree} entrée · ${p.modeles[m].jetonsSortie} sortie` }]))]));
  const noms = Object.fromEntries(r.plats.map((p) => [p.id, p.nom]));
  const page = `<!doctype html><meta charset="utf-8"><title>Comparaison des modèles</title>
<style>body{font:15px/1.45 system-ui,sans-serif;margin:24px;color:#24151A}table{border-collapse:collapse;width:100%;margin:12px 0 32px}
td,th{border:1px solid #e5d9dc;padding:8px;vertical-align:top;text-align:left}th{background:#f8f1f3}.n{font-weight:700;text-align:center;width:52px}
.diff{background:#fff4d6}small{color:#777}</style>
<h1>Accords de ${html(restaurant)} : ${modeles.map(html).join(' / ')}</h1>
${plats.map((p) => {
  const vins = [...new Set(modeles.flatMap((m) => resultats[p][m].lignes.map((l) => l.vin_id)))];
  const trouve = (m: string, v: string) => resultats[p][m].lignes.find((l) => l.vin_id === v);
  return `<h2>${html(noms[p] ?? p)}</h2><p><small>${modeles.map((m) => `${html(m)} : ${resultats[p][m].erreur ? `erreur ${html(resultats[p][m].erreur)}` : `${resultats[p][m].duree} s, ${html(resultats[p][m].jetons)}`}`).join(' — ')}</small></p>
<table><tr><th>Vin</th>${modeles.map((m) => `<th class="n">${html(m.replace('claude-', ''))}</th><th>Commentaire (${html(m.replace('claude-', ''))})</th>`).join('')}</tr>
${vins.map((v) => { const ls = modeles.map((m) => trouve(m, v)); const diff = new Set(ls.map((l) => l?.note)).size > 1;
  return `<tr class="${diff ? 'diff' : ''}"><td>${html(ls.find(Boolean)?.libelle)}</td>${ls.map((l) => `<td class="n">${l?.note ?? '—'}</td><td>${html(l?.commentaire ?? '')}</td>`).join('')}</tr>`; }).join('')}
</table>`; }).join('')}
<p><small>Lignes en jaune : notes différentes entre les modèles. Rien n'a été enregistré : chaque génération a été annulée.</small></p>`;
  writeFileSync(sortie, page);
  console.log(`Comparaison écrite dans ${sortie}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
