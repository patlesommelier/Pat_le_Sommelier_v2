-- Post-it « Imprimez votre chevalet de table » aux visites suivantes : tant que le restaurant n'a pas ouvert la page du
-- chevalet (la première visite, après l'inscription, le guide des premiers pas s'en charge). Les restaurants créés par
-- Quid Vinum ne le voient pas.
alter table restaurant add column if not exists chevalet_annonce_fermee_le timestamptz;
update restaurant set chevalet_annonce_fermee_le = now() where origine <> 'inscription' and chevalet_annonce_fermee_le is null;
