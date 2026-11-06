// Prix d'un vin de distributeur pour un restaurant : le prix public du distributeur moins la remise du restaurant chez lui
// (sa remise propre, sinon celle du distributeur), comme s'il commandait en direct. Le prix QV n'y entre pas : il sert
// seulement à retrouver le prix public quand le tarif ne le donne pas (prix QV ÷ (1 − remise QV)).
// Calcul fait par la fonction SQL prix_restaurant_distributeur (migration 0096) ; jamais le prix QV ni la commission au restaurant.

/** Expression SQL du prix restaurant (HTVA) ; alias du vin du distributeur, du distributeur et du fournisseur du restaurant. */
export const prixRestaurantSql = (v = 'v', d = 'd', f = 'f') =>
  `prix_restaurant_distributeur(${v}.prix_catalogue, ${v}.prix_qv, ${d}.remise_qv, coalesce(${f}.remise, ${d}.remise_restaurant))`;

/** Même calcul côté serveur (affichages du super-admin). */
export function prixRestaurant(publie: number | null, qv: number | null, remiseQv: number | null, remise: number | null): number | null {
  const base = publie ?? (qv != null && remiseQv != null && remiseQv > 0 && remiseQv < 100 ? Math.round((qv / (1 - remiseQv / 100)) * 100) / 100 : null);
  return base == null ? null : Math.round(base * (1 - (remise ?? 0) / 100) * 100) / 100;
}
