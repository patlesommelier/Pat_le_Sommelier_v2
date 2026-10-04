/**
 * Régénère les accords (notes, commentaires, limite) comme le bouton « Régénérer » du back-office, depuis un ordinateur.
 *
 *   npm run regenerer -- --restaurant lola                              → tous les plats
 *   npm run regenerer -- --restaurant lola --plat lola-solettes-meuniere → un seul plat
 *
 * Les accords sont écrits « validés » ; les notes changées à la main dans le back-office sont gardées.
 * Variables : DATABASE_URL, ANTHROPIC_API_KEY, ANTHROPIC_MODEL (facultatif).
 */
import 'dotenv/config';
import { creerLot, etatDernierLot, travailler } from '../src/lib/generation/file';
import { ouvrirPool } from './lib/migrations';

const arg = (nom: string) => { const i = process.argv.indexOf(`--${nom}`); return i > -1 ? process.argv[i + 1] : undefined; };

async function main() {
  const restaurant = arg('restaurant') ?? 'lola';
  const pool = ouvrirPool();
  const q = async <T,>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
  try {
    const plats = arg('plat') ? [arg('plat')!] : (await q<{ id: string }>('select id from plat where restaurant_id = $1 and actif order by ordre', [restaurant])).map((p) => p.id);
    if (!plats.length) throw new Error(`Aucun plat pour « ${restaurant} ».`);
    const { crees } = await creerLot(q, restaurant, plats, 'npm run regenerer');
    console.log(`${crees} plat${crees > 1 ? 's' : ''} à régénérer${crees < plats.length ? ` (${plats.length - crees} déjà en cours ailleurs)` : ''}.`);
    await travailler(q, { finAvant: Number.POSITIVE_INFINITY });
    const e = await etatDernierLot(q, restaurant);
    if (e) console.log(`Terminé : ${e.faits} plat${e.faits > 1 ? 's' : ''} mis à jour${e.erreurs.length ? `, ${e.erreurs.length} en erreur (${e.erreurs.map((x) => x.plat_id).join(', ')})` : ''}.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
