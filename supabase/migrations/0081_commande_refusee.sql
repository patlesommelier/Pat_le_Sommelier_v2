-- Commande refusée par Quid Vinum, avec son motif (montré au restaurant).
alter table commande add column if not exists motif_refus text;
alter table commande drop constraint if exists commande_statut_qv;
alter table commande add constraint commande_statut_qv check (statut_qv in ('recue', 'acceptee', 'envoyee_distributeur', 'livree_partielle', 'livree', 'facturee', 'refusee'));
