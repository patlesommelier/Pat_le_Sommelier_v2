// Pictogrammes d'un vin (♥ coup de cœur, bio, nature) en SQL : pour le vin entier, toutes contenances comprises
// (même restaurant, couleur et intitulé) — une contenance non reliée à la base reprend le bio / nature de sa voisine.
// Bio et nature : le choix du restaurant (vin_carte.bio / nature) prime sur la base de Pat (cuvée).
const MEME_VIN = (v: string) => `s.restaurant_id = ${v}.restaurant_id and s.couleur = ${v}.couleur and lower(s.libelle) = lower(${v}.libelle)`;

export const SQL_PICTOS = (v = 'v') => `
  exists (select 1 from vin_carte s where ${MEME_VIN(v)} and s.coup_de_coeur) as coup_de_coeur,
  exists (select 1 from vin_carte s left join cuvee c on c.id = s.cuvee_id where ${MEME_VIN(v)} and coalesce(s.nature, c.nature, false)) as nature,
  exists (select 1 from vin_carte s left join cuvee c on c.id = s.cuvee_id where ${MEME_VIN(v)} and coalesce(s.bio, c.bio, false)) as bio`;
