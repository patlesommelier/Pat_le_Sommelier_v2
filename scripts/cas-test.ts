/**
 * Vérifie les règles de sélection (src/lib/selection.ts) sur l'onglet « Cas test » de regles_selection.xlsx.
 *
 *   npm run cas-test
 *
 * Lit les fichiers du restaurant (carte, menu, accords) sans toucher à la base, applique les règles
 * et compare au résultat attendu de chaque cas. À relancer après chaque nouvelle version des règles.
 */
import fs from 'node:fs';
import path from 'node:path';
import { importerRestaurant } from './lib/restaurant';
import { cle, enObjets, lireFeuille, texte } from './lib/util';
import { selectionner, type Candidat } from '../src/lib/selection';

const dossier = path.join('data', 'restaurants', process.argv[2] ?? 'lola');

async function main() {
  const meta = JSON.parse(fs.readFileSync(path.join(dossier, 'restaurant.json'), 'utf8'));
  const fichierRegles = path.join(dossier, meta.fichiers.regles_selection ?? 'regles_selection.xlsx');
  // Les bases de Pat ne servent pas ici : le ranking vient de la carte.
  const r = await importerRestaurant(dossier, [], [], [], (s) => s);

  const vins: Candidat[] = r.vins.map((v) => ({
    id: String(v.id), libelle: String(v.libelle), couleur: String(v.couleur), format: String(v.format),
    prix: (v.prix as number | null) ?? null, ordre: Number(v.ordre),
    ranking_producteur: v.ranking_producteur as number, ranking_terroir: v.ranking_terroir as number,
    pays: v.pays as string, cepages: v.cepages as string | null,
    appellation: String(v.vin_texte ?? '').split(' – ')[0].replace(/\(.*?\)/g, '').trim(),
    notes: Object.fromEntries(r.accords.filter((a) => a.vin_id === v.id).map((a) => [String(a.plat_id), Number(a.note)])),
  }));

  const lignes = await lireFeuille(fichierRegles, 'Cas test');
  const cas: { plats: string[]; texte: string; attendu: string[] }[] = [];
  let courant: (typeof cas)[number] | null = null;
  for (const [a, b] of lignes) {
    const col0 = String(a ?? ''), col1 = String(b ?? '');
    if (col0 === 'Plat') {
      const noms = col1.replace(/\s*\(onglet[^)]*\)\s*$/, '').split(/\s+\+\s+/);
      const plats = noms.map((n) => r.plats.find((p) => cle(n).startsWith(cle(String(p.nom))) || cle(String(p.nom)).startsWith(cle(n)))?.id as string);
      if (plats.some((p) => !p)) throw new Error(`Plat introuvable dans le menu : ${col1}`);
      courant = { plats, texte: col1, attendu: [] };
      cas.push(courant);
    } else if (courant && /^\d+$/.test(col0) && /^L-[A-Z]\d{2}/.test(col1)) {
      courant.attendu.push(col1.slice(0, 5));
    }
  }

  let echecs = 0;
  cas.forEach((c, i) => {
    const { liste } = selectionner(vins, c.plats);
    const obtenu = liste.map((x) => x.vin.id);
    const ok = obtenu.join() === c.attendu.join();
    if (!ok) echecs++;
    console.log(`${ok ? '✓' : '✗'} Cas ${i + 1} — ${c.texte}`);
    console.log(`    attendu : ${c.attendu.join(', ')}`);
    if (!ok) console.log(`    obtenu  : ${obtenu.join(', ')}`);
    if (!ok) liste.forEach((x) => console.log(`      ${x.vin.id} note ${x.note} score ${x.score} (${x.motif})`));
  });
  console.log(echecs ? `\n${echecs} cas en échec sur ${cas.length}.` : `\nLes ${cas.length} cas sont conformes.`);
  if (texte(process.env.CI) && echecs) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
