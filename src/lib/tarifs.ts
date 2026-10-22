// Prix d'un vin dans chacune de ses contenances (bouteille, demi, quart, magnum, verre), pour l'app des clients.
// Une contenance est une ligne de la carte (disponible) ; le verre est le prix au verre d'une de ces lignes.
import 'server-only';
import { requete } from './db';
import { grouperMemeVin, tarifsDuGroupe, type Tarif } from './contenances';

export type { Tarif } from './contenances';

/** Tarifs de tous les vins disponibles d'un restaurant, par ligne de la carte (chaque ligne reçoit ceux de son vin). */
export async function tarifsDuRestaurant(restaurantId: string) {
  const lignes = await requete<{ id: string; couleur: string; libelle: string; millesime: string | null; format: string; prix: number | null; prix_verre: number | null }>(
    `select id, couleur::text, libelle, millesime, format, prix::float as prix, prix_verre::float as prix_verre
       from vin_carte where restaurant_id = $1 and disponible order by ordre, id`, [restaurantId]);
  const parLigne = new Map<string, Tarif[]>();
  for (const groupe of grouperMemeVin(lignes, (l) => l.format)) {
    const t = tarifsDuGroupe(groupe);
    for (const l of groupe) parLigne.set(l.id, t);
  }
  return parLigne;
}

/** Tarifs d'un vin (vides : le vin n'a pas de prix). */
export async function tarifsDuVin(restaurantId: string, vinId: string) {
  return (await tarifsDuRestaurant(restaurantId)).get(vinId) ?? [];
}
