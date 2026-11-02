// Restaurant verrouillé sur un seul distributeur Quid Vinum (restaurant.distributeur_qv_unique, réglé par le super-admin).

/** Condition SQL : le distributeur `d` est permis au restaurant `resto` (paramètre SQL, ex. « $1 »). */
export const distributeurPermis = (resto: string, d = 'd.id') =>
  `not exists (select 1 from restaurant rz where rz.id = ${resto} and rz.distributeur_qv_unique is not null and rz.distributeur_qv_unique <> ${d})`;
