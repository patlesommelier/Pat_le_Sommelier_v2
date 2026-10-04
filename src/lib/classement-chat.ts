import 'server-only';
import { getCandidats, getReglages } from './donnees';
import { selectionner, tourSuivant } from './selection';

/**
 * Classement des vins de chaque plat pour le chat de Pat, calculé ici avec les règles du sommelier du restaurant
 * (les mêmes que la page « Mes propositions ») : Tour 1, puis les tours suivants jusqu'à épuisement.
 * Les vins notés sous le seuil n'y figurent pas. Texte réservé au prompt (cuisine interne : notes /5).
 */
export async function texteClassements(restaurantId: string, plats: { id: string; nom: string }[]): Promise<string> {
  if (!plats.length) return 'Aucun plat au menu.';
  const [{ candidats }, R] = await Promise.all([getCandidats(restaurantId, plats.map((p) => p.id)), getReglages(restaurantId)]);
  return plats
    .map((p) => {
      const surCePlat = candidats.filter((c) => typeof c.notes[p.id] === 'number');
      const sel = selectionner(surCePlat, [p.id], { reglages: R });
      const ligne = (vins: { vin: { id: string }; note: number }[]) => vins.map((r) => `${r.vin.id} (${r.note})`).join(', ');
      const lignes = [`${p.nom} [${p.id}]`, `  Tour 1 : ${sel.liste.length ? ligne(sel.liste) : 'aucun vin'}`];
      const proposes = sel.liste.map((r) => r.vin.id);
      for (let tour = 2; tour <= 12; tour++) {
        const suite = tourSuivant(sel, proposes, R.tourSuivant, R.diversite, R.plafondBulles);
        if (!suite.length) break;
        lignes.push(`  Tour ${tour} : ${ligne(suite)}`);
        proposes.push(...suite.map((r) => r.vin.id));
      }
      return lignes.join('\n');
    })
    .join('\n');
}
