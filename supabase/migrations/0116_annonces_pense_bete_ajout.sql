-- Post-its des visites suivantes : « Imprimez le pense-bête » (jusqu'à sa première impression) et « Ajoutez un vin »
-- (jusqu'à la première visite de la page Ajouter un vin). Les restaurants créés par Quid Vinum ne les voient pas.
alter table restaurant add column if not exists pense_bete_annonce_fermee_le timestamptz;
alter table restaurant add column if not exists ajout_annonce_fermee_le timestamptz;
update restaurant set pense_bete_annonce_fermee_le = now() where origine <> 'inscription' and pense_bete_annonce_fermee_le is null;
update restaurant set ajout_annonce_fermee_le = now() where origine <> 'inscription' and ajout_annonce_fermee_le is null;
-- « Faites l'inventaire sur votre mobile » : jusqu'à la première visite de la page Faire l'inventaire.
alter table restaurant add column if not exists inventaire_annonce_fermee_le timestamptz;
update restaurant set inventaire_annonce_fermee_le = now() where (origine <> 'inscription' or inventaire_le is not null) and inventaire_annonce_fermee_le is null;
