-- Post-it 9 « Ajouter un vin / commander » : montré une fois qu'un distributeur a été ajouté, jusqu'à la première visite
-- de la page « Ajouter un vin ». Les restaurants créés par Quid Vinum ne le voient pas (déjà accompagnés).
alter table restaurant add column if not exists commandes_annonce_fermee_le timestamptz;
update restaurant set commandes_annonce_fermee_le = now() where origine <> 'inscription' and commandes_annonce_fermee_le is null;
