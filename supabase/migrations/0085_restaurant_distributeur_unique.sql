-- Restaurant « verrouillé » sur un seul distributeur Quid Vinum (réglé par le super-admin) : il ne voit, ne cherche
-- et ne commande que dans le catalogue de celui-ci. Vide : tous les distributeurs Quid Vinum lui sont proposés.
alter table restaurant add column if not exists distributeur_qv_unique text references distributeur(id) on delete set null;
