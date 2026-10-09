// Prix d'un vin dans chacune de ses contenances (bouteille, demi, quart, magnum, verre), pour l'app des clients.
// Une contenance est une ligne de la carte (disponible) ; le verre est le prix au verre d'une de ces lignes.
import 'server-only';
import { requete } from './db';
import { cleMemeVin, contenanceDuFormat } from './contenances';

export interface Tarif { code: string; libelle: string; prix: number }

const ORDRE = ['bouteille', 'demi', 'quart', 'magnum', 'verre'];
const LIBELLES: Record<string, string> = { bouteille: 'Bouteille', demi: 'Demi-bouteille', quart: 'Quart de bouteille', magnum: 'Magnum', verre: 'Au verre' };

/** Tarifs de tous les vins disponibles d'un restaurant, par vin (clé : même couleur, intitulé et millésime). */
export async function tarifsDuRestaurant(restaurantId: string) {
  const lignes = await requete<{ couleur: string; libelle: string; millesime: string | null; format: string; prix: number | null; prix_verre: number | null }>(
    `select couleur::text, libelle, millesime, format, prix::float as prix, prix_verre::float as prix_verre
       from vin_carte where restaurant_id = $1 and disponible order by ordre`, [restaurantId]);
  const parVin = new Map<string, Tarif[]>();
  for (const l of lignes) {
    const t = parVin.get(cleMemeVin(l)) ?? [];
    const code = contenanceDuFormat(l.format);
    const ajouter = (c: string, prix: number | null) => {
      if (prix != null && !t.some((x) => x.code === c)) t.push({ code: c, libelle: LIBELLES[c] ?? c, prix });
    };
    ajouter(code, code === 'verre' ? l.prix_verre ?? l.prix : l.prix);
    ajouter('verre', l.prix_verre);
    parVin.set(cleMemeVin(l), t);
  }
  for (const t of parVin.values()) t.sort((a, b) => ORDRE.indexOf(a.code) - ORDRE.indexOf(b.code));
  return parVin;
}

/** Tarifs d'un vin (vides : le vin n'a pas de prix). */
export async function tarifsDuVin(restaurantId: string, v: { couleur: string; libelle: string; millesime: string | null }) {
  return (await tarifsDuRestaurant(restaurantId)).get(cleMemeVin(v)) ?? [];
}
