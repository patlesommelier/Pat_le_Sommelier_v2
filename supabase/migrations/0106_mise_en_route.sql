-- Mise en route des restaurants inscrits seuls.
-- premier_client_le : première ouverture de l'app par un client (pas par un compte du restaurant ni par Quid Vinum).
--   Tant qu'elle est vide, l'espace restaurant montre « Votre mise en route » et cache la Gestion de cave.
-- cave_annonce_fermee_le : le restaurant a fermé le bandeau « Suivez vos stocks avec Pat ».
-- relance_1_le, relance_2_le : e-mails de relance envoyés (le lendemain, puis 3 jours après l'inscription).
alter table restaurant add column if not exists premier_client_le timestamptz;
alter table restaurant add column if not exists cave_annonce_fermee_le timestamptz;
alter table restaurant add column if not exists relance_1_le timestamptz;
alter table restaurant add column if not exists relance_2_le timestamptz;
-- Restaurants déjà ouverts à leurs clients : rien ne change pour eux (pas de mise en route, cave visible, pas de bandeau).
update restaurant set premier_client_le = premier_scan_le, cave_annonce_fermee_le = now()
 where premier_scan_le is not null and premier_client_le is null;
