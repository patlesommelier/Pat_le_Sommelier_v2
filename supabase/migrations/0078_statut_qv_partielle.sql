-- Suivi Quid Vinum : « livraison partielle » entre « envoyée au distributeur » et « bouteilles livrées ».
alter table commande drop constraint if exists commande_statut_qv;
alter table commande add constraint commande_statut_qv check (statut_qv in ('recue', 'acceptee', 'envoyee_distributeur', 'livree_partielle', 'livree', 'facturee'));
