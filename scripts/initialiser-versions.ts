/**
 * Premières versions des principes et des règles de Pat.
 *
 *   npm run versions                       → simulation : valide les fichiers et affiche les différences, n'écrit rien
 *   npm run versions -- --ecrire           → écrit : V5 en service, V6 en brouillon, règles V7 en service
 *   npm run versions -- --en-service V5=data/pat/principes_pat_V5.xlsx --brouillon V6=data/pat/principes_pat_V6.xlsx --regles V7
 *
 * La version en service est installée sans publication (les accords en place ont été calculés avec elle).
 * Le brouillon sera mis en service par « Publier les principes » (préparation, puis confirmation).
 * Idempotent : relancer réécrit les mêmes versions. Variable : DATABASE_URL.
 */
import 'dotenv/config';
import fs from 'node:fs';
import { differences, lireFichier, valider } from '../src/lib/principes/format';
import { importerVersion, installerEnService, versionEnService } from '../src/lib/principes/versions';
import { installerReglesEnService, reglesEnService } from '../src/lib/regles/versions';
import { REGLAGES_PAT } from '../src/lib/selection';
import { ouvrirPool } from './lib/migrations';

const arg = (nom: string, defaut: string) => { const i = process.argv.indexOf(`--${nom}`); return i > -1 ? process.argv[i + 1] : defaut; };
const coupe = (v: string) => { const [code, fichier] = v.split('='); return { code, fichier }; };

async function main() {
  const ecrire = process.argv.includes('--ecrire');
  const service = coupe(arg('en-service', 'V5=data/pat/principes_pat_V5.xlsx'));
  const brouillon = coupe(arg('brouillon', 'V6=data/pat/principes_pat_V6.xlsx'));
  const codeRegles = arg('regles', 'V7');

  const lire = async ({ code, fichier }: { code: string; fichier: string }) => {
    const v = await lireFichier(fichier, fs.readFileSync(fichier));
    const { erreurs, avertissements } = valider(v);
    console.log(`${code} (${fichier}) : ${v.principes.length} principes, ${v.principes.filter((p) => p.statut === 'archive').length} archivés, ` +
      `${v.principes.filter((p) => p.aRelire).length} à relire — ${erreurs.length} erreur(s), ${avertissements.length} avertissement(s)`);
    for (const e of [...erreurs, ...avertissements]) console.log(`   · ${e}`);
    if (erreurs.length) throw new Error(`${code} : fichier refusé.`);
    return v;
  };
  const vService = await lire(service);
  const vBrouillon = await lire(brouillon);
  const d = differences(vService, vBrouillon);
  console.log(`Différences ${service.code} → ${brouillon.code} : archivés ${d.archives.join(', ') || '—'} ; modifiés ${d.modifies.map((m) => m.n).join(', ') || '—'} ; ` +
    `ajoutés ${d.ajoutes.join(', ') || '—'} ; supprimés ${d.supprimes.join(', ') || '—'}`);

  const pool = ouvrirPool();
  const q = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
  try {
    const [actuelP, actuelR] = await Promise.all([versionEnService(q), reglesEnService(q)]);
    console.log(`En base : principes en service ${actuelP?.code ?? 'aucune'} ; règles en service ${actuelR?.code ?? 'aucune'}.`);
    if (!ecrire) {
      console.log('Simulation : rien n’a été écrit. Relancez avec --ecrire.');
      return;
    }
    await installerEnService(q, service.code, vService, 'initialisation', service.fichier);
    const r = await importerVersion(q, { nomFichier: brouillon.fichier, contenu: fs.readFileSync(brouillon.fichier), par: 'initialisation',
      code: brouillon.code, remplacerBrouillon: true });
    if (r.erreurs.length) throw new Error(r.erreurs.join('\n'));
    await installerReglesEnService(q, codeRegles, REGLAGES_PAT, 'initialisation', 'Règles de sélection V7 (regles_selection.xlsx, 30/09/2026).');
    console.log(`Écrit : principes ${service.code} en service, ${brouillon.code} en brouillon ; règles ${codeRegles} en service.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
