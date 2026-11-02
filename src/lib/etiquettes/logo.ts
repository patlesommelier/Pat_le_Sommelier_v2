// Vin sans étiquette : le logo de son distributeur (Quid Vinum) est montré à la place, en attendant une vraie photo.
// Affichage seulement : rien n'est enregistré comme étiquette (une photo déposée ensuite prend sa place, et entre dans la base).

/** Logo du distributeur du vin de carte `v` : celui de son fournisseur Quid Vinum, sinon du vin de catalogue auquel il est relié. */
export const SQL_LOGO_DISTRIBUTEUR = (v = 'v') => `(select d.logo_url from distributeur d where d.logo_url is not null and d.id = coalesce(
  (select f.distributeur_id from fournisseur f where f.id = ${v}.fournisseur_id),
  (select dv.distributeur_id from distributeur_vin dv where dv.id = ${v}.distributeur_vin_id)))`;
