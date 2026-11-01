-- Suivi par Quid Vinum des commandes qui passent par lui : reçue → acceptée → envoyée au distributeur → livrée → facturée.
alter table commande add column if not exists statut_qv text;
do $$ begin
  alter table commande add constraint commande_statut_qv check (statut_qv in ('recue', 'acceptee', 'envoyee_distributeur', 'livree', 'facturee'));
exception when duplicate_object then null; end $$;
alter table commande add column if not exists statut_qv_le timestamptz;
-- Commandes Quid Vinum déjà envoyées : reçues par Quid Vinum (livrées si le restaurant les a réceptionnées).
update commande c set statut_qv = case when c.statut = 'recue' then 'livree' else 'recue' end, statut_qv_le = coalesce(c.recue_le, c.envoyee_le)
 where c.statut_qv is null and c.envoyee_le is not null
   and (c.quid_vinum or exists (select 1 from fournisseur f where f.id = c.fournisseur_id and f.distributeur_id is not null));
