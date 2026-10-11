// Prix d'un vin dans chacune de ses contenances (bouteille, demi, quart, magnum, verre), pour l'app des clients.
// Une contenance est une ligne de la carte (disponible) ; le verre est le prix au verre d'une de ces lignes.
import 'server-only';
import { requete } from './db';
import { contenanceDuFormat, estPichet, grouperMemeVin } from './contenances';

export interface Tarif { code: string; libelle: string; prix: number }

const ORDRE = ['bouteille', 'demi', 'quart', 'magnum', 'verre'];
const LIBELLES: Record<string, string> = { bouteille: 'Bouteille', demi: 'Demi-bouteille', quart: 'Quart de bouteille', magnum: 'Magnum', verre: 'Au verre' };

/** Tarifs de tous les vins disponibles d'un restaurant, par ligne de la carte (chaque ligne reçoit ceux de son vin). */
export async function tarifsDuRestaurant(restaurantId: string) {
  const lignes = await requete<{ id: string; couleur: string; libelle: string; millesime: string | null; format: string; prix: number | null; prix_verre: number | null }>(
    `select id, couleur::text, libelle, millesime, format, prix::float as prix, prix_verre::float as prix_verre
       from vin_carte where restaurant_id = $1 and disponible order by ordre, id`, [restaurantId]);
  const parLigne = new Map<string, Tarif[]>();
  for (const groupe of grouperMemeVin(lignes, (l) => l.format)) {
    const t: Tarif[] = [];
    // Au verre en plusieurs contenants (verres, pichet, carafe) : seul le prix le plus petit est affiché.
    const ajouter = (c: string, prix: number | null) => {
      if (prix == null) return;
      const deja = t.find((x) => x.code === c);
      if (!deja) t.push({ code: c, libelle: LIBELLES[c] ?? c, prix });
      else if (c === 'verre' && prix < deja.prix) deja.prix = prix;
    };
    const auVerre = groupe.some((l) => contenanceDuFormat(l.format) === 'verre' || l.prix_verre != null);
    for (const l of groupe) {
      if (auVerre && estPichet(l.format)) continue;
      const code = contenanceDuFormat(l.format);
      ajouter(code, code === 'verre' ? l.prix_verre ?? l.prix : l.prix);
      ajouter('verre', l.prix_verre);
    }
    t.sort((a, b) => ORDRE.indexOf(a.code) - ORDRE.indexOf(b.code));
    for (const l of groupe) parLigne.set(l.id, t);
  }
  return parLigne;
}

/** Tarifs d'un vin (vides : le vin n'a pas de prix). */
export async function tarifsDuVin(restaurantId: string, vinId: string) {
  return (await tarifsDuRestaurant(restaurantId)).get(vinId) ?? [];
}
