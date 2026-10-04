/**
 * « Le mot de Pat » pour la carte des vins imprimée : une phrase par vin disponible, générée couleur par couleur.
 *
 *   npm run mots -- --restaurant lola              → écrit les phrases valides (champ mot_pat)
 *   npm run mots -- --restaurant lola --apercu     → affiche seulement, n'écrit rien
 *
 * Une phrase corrigée par le restaurant dans le back-office (mot_pat_perso) reste prioritaire et n'est pas touchée.
 * Variables : DATABASE_URL, ANTHROPIC_API_KEY, ANTHROPIC_MODEL (facultatif).
 */
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { genererMots, type VinMot } from '../src/lib/generation/mots';
import { ouvrirPool } from './lib/migrations';

const arg = (nom: string) => { const i = process.argv.indexOf(`--${nom}`); return i > -1 ? process.argv[i + 1] : undefined; };

async function main() {
  const restaurant = arg('restaurant') ?? 'lola';
  const apercu = process.argv.includes('--apercu');
  const pool = ouvrirPool();
  const q = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
  try {
    const [r] = await q<{ nom: string }>('select nom from restaurant where id = $1', [restaurant]);
    if (!r) throw new Error(`Restaurant « ${restaurant} » introuvable.`);
    // Pas de ranking ni d'avis interne : seulement ce qui décrit le vin.
    const vins = await q<VinMot>(
      `select v.id, v.libelle as nom, coalesce(p.nom, v.producteur_texte) as producteur, nullif(v.millesime, 'NM') as millesime,
              v.couleur::text as couleur, v.section as region, v.cepages, v.presentation as commentaires, v.descriptif
         from vin_carte v left join producteur p on p.id = v.producteur_id
        where v.restaurant_id = $1 and v.disponible order by v.ordre`, [restaurant]);
    const mots = await genererMots(vins, r.nom, new Anthropic(), process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5');
    for (const v of vins) console.log(`${v.id} ${mots[v.id] ? `· ${mots[v.id]}` : '· (à relire : pas de phrase valide)'}`);
    if (!apercu) {
      for (const [id, mot] of Object.entries(mots)) await q('update vin_carte set mot_pat = $3 where restaurant_id = $1 and id = $2', [restaurant, id, mot]);
    }
    console.log(`\n${Object.keys(mots).length}/${vins.length} phrases valides${apercu ? ' (aperçu : rien n’a été écrit)' : ' écrites'}.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
