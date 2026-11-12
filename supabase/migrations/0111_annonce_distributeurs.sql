-- Post-it 5 « Configurez vos distributeurs de vin » : montré après le premier inventaire, jusqu'à la première visite de la
-- page Distributeurs. Les restaurants qui ont déjà fait un inventaire ne le voient pas (déjà en route).
alter table restaurant add column if not exists distributeurs_annonce_fermee_le timestamptz;
update restaurant set distributeurs_annonce_fermee_le = now() where inventaire_le is not null and distributeurs_annonce_fermee_le is null;
