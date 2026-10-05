import 'server-only';
import { cache } from 'react';
import { utilisateurCourant } from './admin/auth';
import { getRestaurant } from './donnees';

/**
 * L'app client d'un restaurant n'est ouverte au public qu'« en service » : tant que ses accords ne sont pas tous
 * prêts (mise en place) ou s'il est suspendu, un client qui scanne le QR code voit une page d'attente.
 * Le restaurant et Pat, connectés, la voient normalement (simulateur, aperçu).
 */
export const appOuverte = cache(async (restaurantId: string) => {
  const r = await getRestaurant(restaurantId);
  if (!r) return false;
  if (!r.statut || r.statut === 'en_service') return true;
  const u = await utilisateurCourant().catch(() => null);
  return Boolean(u && (u.admin || u.restaurants.includes(restaurantId)));
});
