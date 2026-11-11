import 'server-only';
import { redirect } from 'next/navigation';
import { exigerAcces } from './auth';
import { getRestaurantBO } from './donnees';
import { caveVisible, carteValidee } from './prochaine-etape';

/**
 * Page de la Gestion de cave (Ma cave, inventaire, commandes, distributeurs) : comme exigerAcces, et en plus, pour un restaurant
 * inscrit seul, seulement une fois sa carte validée par Quid Vinum et la cave ouverte ; sinon retour au tableau de bord.
 */
export async function exigerCave(resto: string) {
  const u = await exigerAcces(resto);
  if (!u.admin) {
    const r = await getRestaurantBO(resto);
    if (r && !caveVisible(r)) redirect(`/admin/${resto}`);
  }
  return u;
}

/** Impression de la carte des vins : ouverte une fois la carte validée par Quid Vinum (toujours pour le super-admin). */
export async function impressionCarteOuverte(resto: string, admin: boolean) {
  if (admin) return true;
  const r = await getRestaurantBO(resto);
  return !r || carteValidee(r);
}
