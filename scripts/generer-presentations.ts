/**
 * Présentation de chaque vin pour la carte des vins imprimée (3 phrases, 3 à 4 lignes), générée couleur par couleur.
 *
 *   npm run presentations -- --restaurant lola              → écrit les présentations valides (presentation_carte)
 *   npm run presentations -- --restaurant lola --apercu     → affiche seulement, n'écrit rien
 *
 * Un vin dont la présentation a été corrigée par le restaurant (presentation_carte_perso) n'est pas régénéré.
 * Pat s'appuie uniquement sur le descriptif du vin, la présentation du domaine, l'avis de Pat sur le producteur et les cépages.
 * Variables : DATABASE_URL, ANTHROPIC_API_KEY, ANTHROPIC_MODEL (facultatif).
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { genererPresentations, SQL_VINS_A_PRESENTER, type VinPresentation } from '../src/lib/generation/presentations';
import { ouvrirPool } from './lib/migrations';
import { clientClaude } from '../src/lib/claude';

const arg = (nom: string) => { const i = process.argv.indexOf(`--${nom}`); return i > -1 ? process.argv[i + 1] : undefined; };

async function main() {
  const restaurant = arg('restaurant') ?? 'lola';
  const apercu = process.argv.includes('--apercu');
  const pool = ouvrirPool();
  const q = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
  try {
    const [r] = await q<{ nom: string }>('select nom from restaurant where id = $1', [restaurant]);
    if (!r) throw new Error(`Restaurant « ${restaurant} » introuvable.`);
    // Pas de ranking : seulement ce qui décrit le vin et son domaine.
    const vins = await q<VinPresentation>(`${SQL_VINS_A_PRESENTER} order by v.ordre`, [restaurant]);
    const textes = await genererPresentations(vins, r.nom, clientClaude(), process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5');
    for (const v of vins) console.log(`${v.id} · ${textes[v.id] ?? '(à relire : pas de présentation valide)'}\n`);
    if (!apercu) {
      for (const [id, texte] of Object.entries(textes)) await q('update vin_carte set presentation_carte = $3 where restaurant_id = $1 and id = $2', [restaurant, id, texte]);
    }
    console.log(`${Object.keys(textes).length}/${vins.length} présentations valides${apercu ? ' (aperçu : rien n’a été écrit)' : ' écrites'}.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
