-- Post-it 7 « Accords » : expliqué au restaurant jusqu'à sa première visite de la page des accords. Les restaurants créés
-- par Quid Vinum ne le voient pas (déjà accompagnés).
alter table restaurant add column if not exists accords_annonce_fermee_le timestamptz;
update restaurant set accords_annonce_fermee_le = now() where origine <> 'inscription' and accords_annonce_fermee_le is null;
